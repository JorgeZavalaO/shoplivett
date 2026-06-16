"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireRole, getCurrentUser } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { CreateOrderSchema, type CreateOrderInput } from "@/lib/validations";
import { createQuickSale, OrderError } from "@/lib/sales";
import { getOpenLive } from "@/lib/live";

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

export type VariantSearchResult = {
  id: string;
  code: string;
  color: string | null;
  size: string | null;
  price: string;
  available: number;
  productName: string;
  categoryName: string;
};

export async function searchVariantsForSaleAction(
  query: string,
): Promise<VariantSearchResult[]> {
  await requireRole(["ADMIN", "SELLER"]);
  if (!query.trim()) return [];
  const prisma = getPrisma();
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
    },
  });

  return rows.map((v) => ({
    id: v.id,
    code: v.code,
    color: v.color,
    size: v.size,
    price: v.price.toString(),
    available: Math.max(0, v.stock - v.reservedStock - v.soldStock),
    productName: v.product.name,
    categoryName: v.product.category.name,
  }));
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
