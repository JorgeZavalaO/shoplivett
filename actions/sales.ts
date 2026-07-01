"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireRole, getCurrentUser } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { CreateOrderSchema, type CreateOrderInput } from "@/lib/validations";
import { createQuickSale, OrderError } from "@/lib/sales";
import { getOpenLive } from "@/lib/live";
import { isSalesChannel } from "@/lib/order-batch-allocation";
import { getEnabledSalesChannels, getSettings } from "@/lib/settings";
import { SALES_CHANNEL_LABELS } from "@/lib/settings-defaults";
import { getItemPricing } from "@/lib/import-batch-costing";

export type OrderActionResult = {
  ok: boolean;
  message?: string;
  fieldErrors?: Partial<Record<keyof CreateOrderInput, string>>;
  orderId?: string;
};

function fieldErrorsFromZod(
  issues: z.ZodIssue[],
): OrderActionResult["fieldErrors"] {
  const out: OrderActionResult["fieldErrors"] = {};
  for (const issue of issues) {
    const key = issue.path[0] as keyof CreateOrderInput | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

function readForm(formData: FormData): Record<string, unknown> {
  return {
    customerId: String(formData.get("customerId") ?? "").trim(),
    liveSessionId: String(formData.get("liveSessionId") ?? "").trim(),
    items: String(formData.get("items") ?? "").trim(),
    discount: String(formData.get("discount") ?? "0").trim(),
    shippingAmount: String(formData.get("shippingAmount") ?? "0").trim(),
    advanceAmount: String(formData.get("advanceAmount") ?? "").trim(),
    paymentMethod: String(formData.get("paymentMethod") ?? "").trim(),
    operationNumber: String(formData.get("operationNumber") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
    salesChannel: String(formData.get("salesChannel") ?? "").trim(),
  };
}

export async function createQuickSaleAction(
  _prev: OrderActionResult | undefined,
  formData: FormData,
): Promise<OrderActionResult> {
  await requireRole(["ADMIN", "SELLER"]);

  const parsed = CreateOrderSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los datos del formulario.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  const receiptFiles: File[] = [];
  for (const [key, value] of formData.entries()) {
    if (key === "receipts" && value instanceof File && value.size > 0) {
      receiptFiles.push(value);
    }
  }

  try {
    const user = await getCurrentUser();
    const salesChannelRaw = parsed.data.salesChannel;
    const salesChannel =
      salesChannelRaw && isSalesChannel(salesChannelRaw)
        ? salesChannelRaw
        : "WHATSAPP_DIRECTO";
    const result = await createQuickSale({
      customerId: parsed.data.customerId,
      liveSessionId: parsed.data.liveSessionId,
      items: parsed.data.items,
      discount: parsed.data.discount,
      shippingAmount: parsed.data.shippingAmount,
      advanceAmount: parsed.data.advanceAmount,
      paymentMethod: parsed.data.paymentMethod,
      operationNumber: parsed.data.operationNumber,
      notes: parsed.data.notes,
      salesChannel,
      receiptFiles: receiptFiles.length > 0 ? receiptFiles : undefined,
      actorId: user?.id ?? null,
    });

    revalidatePath("/ventas");
    revalidatePath("/pedidos");
    redirect(`/pedidos/${result.orderId}`);
  } catch (error) {
    if (error instanceof OrderError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function getActiveLivesAction() {
  await requireRole(["ADMIN", "SELLER"]);
  const open = await getOpenLive();
  return open ? [open] : [];
}

export type SalesChannelOption = {
  value: string;
  label: string;
};

export async function getEnabledSalesChannelsAction(): Promise<SalesChannelOption[]> {
  await requireRole(["ADMIN", "SELLER"]);
  const channels = await getEnabledSalesChannels();
  return channels.map((value) => ({
    value,
    label: SALES_CHANNEL_LABELS[value],
  }));
}

export type VariantSearchResult = {
  id: string;
  code: string;
  color: string | null;
  size: string | null;
  price: string;
  available: number;
  productName: string;
  categoryName: string;
  operatesWithBatches?: boolean;
  unitRealCost?: string | null;
  minimumPrice?: string | null;
  suggestedPrice?: string | null;
  currentMarginPercent?: number | null;
  costSource?: "BATCH" | "LEGACY" | "NONE";
};

export async function searchVariantsForSaleAction(
  query: string,
): Promise<VariantSearchResult[]> {
  await requireRole(["ADMIN", "SELLER"]);
  if (!query.trim()) return [];
  const prisma = getPrisma();
  const settings = await getSettings();
  const rows = await prisma.productVariant.findMany({
    where: {
      status: "ACTIVE",
      product: { isActive: true },
      OR: [
        { code: { contains: query, mode: "insensitive" } },
        { product: { name: { contains: query, mode: "insensitive" } } },
        { color: { contains: query, mode: "insensitive" } },
      ],
    },
    take: 20,
    select: {
      id: true,
      code: true,
      color: true,
      size: true,
      price: true,
      cost: true,
      stock: true,
      reservedStock: true,
      soldStock: true,
      product: {
        select: {
          id: true,
          name: true,
          category: { select: { name: true } },
        },
      },
      batchItems: {
        where: { calculatedAt: { not: null } },
        select: {
          id: true,
          landedUnitCostPen: true,
          quantityAvailable: true,
        },
      },
    },
  });

  return rows.map((v) => {
    const available = Math.max(0, v.stock - v.reservedStock - v.soldStock);
    const totalAvailable = v.batchItems.reduce(
      (acc, item) => acc + item.quantityAvailable,
      0,
    );
    const unitRealCost = totalAvailable > 0
      ? v.batchItems.reduce((acc, item) => {
          return acc + Number(item.landedUnitCostPen.toString()) * item.quantityAvailable;
        }, 0) / totalAvailable
      : v.cost
        ? Number(v.cost.toString())
        : null;
    const costSource = totalAvailable > 0 ? "BATCH" : v.cost ? "LEGACY" : "NONE";
    const pricing = unitRealCost !== null
      ? getItemPricing(unitRealCost, Number(v.price.toString()), {
          minimumTargetMarginBps: settings.minimumTargetMarginBps,
          objectiveTargetMarginBps: settings.objectiveTargetMarginBps,
        })
      : null;

    return {
      id: v.id,
      code: v.code,
      color: v.color,
      size: v.size,
      price: v.price.toString(),
      available,
      productName: v.product.name,
      categoryName: v.product.category.name,
      operatesWithBatches: v.batchItems.length > 0,
      unitRealCost: unitRealCost !== null ? unitRealCost.toFixed(4) : null,
      minimumPrice: pricing ? pricing.minimumPrice.toFixed(2) : null,
      suggestedPrice: pricing ? pricing.suggestedPrice.toFixed(2) : null,
      currentMarginPercent: pricing ? pricing.currentMarginPercent : null,
      costSource,
    };
  });
}

export async function searchCustomersForSaleAction(
  query: string,
) {
  await requireRole(["ADMIN", "SELLER"]);
  if (!query.trim()) return [];
  const prisma = getPrisma();
  return prisma.customer.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { whatsapp: { contains: query.replace(/\D/g, "") } },
      ],
    },
    take: 20,
    orderBy: { name: "asc" },
    select: { id: true, name: true, whatsapp: true },
  });
}
