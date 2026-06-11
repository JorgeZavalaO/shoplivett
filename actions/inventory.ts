"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/permissions";
import { adjustStock, InventoryError } from "@/lib/inventory";
import { InventoryAdjustSchema } from "@/lib/validations";

export type InventoryAdjustActionResult = {
  ok: boolean;
  message?: string;
  fieldErrors?: Partial<Record<keyof z.infer<typeof InventoryAdjustSchema>, string>>;
};

function fieldErrorsFromZod(
  issues: z.ZodIssue[],
): InventoryAdjustActionResult["fieldErrors"] {
  const out: InventoryAdjustActionResult["fieldErrors"] = {};
  for (const issue of issues) {
    const key = issue.path[0] as keyof z.infer<typeof InventoryAdjustSchema> | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

function readForm(formData: FormData) {
  return {
    type: String(formData.get("type") ?? "IN"),
    quantity: String(formData.get("quantity") ?? "").trim(),
    reason: String(formData.get("reason") ?? "").trim(),
  };
}

export async function adjustStockAction(
  variantId: string,
  _prev: InventoryAdjustActionResult | undefined,
  formData: FormData,
): Promise<InventoryAdjustActionResult> {
  await requireUser();
  if (!variantId) return { ok: false, message: "Falta la variante." };

  const parsed = InventoryAdjustSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los datos del formulario.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  try {
    await adjustStock(
      variantId,
      parsed.data.signedQuantity,
      parsed.data.reason,
    );
    revalidatePath("/inventario");
    revalidatePath(`/inventario/${variantId}`);
    return { ok: true, message: "Stock ajustado correctamente." };
  } catch (error) {
    if (error instanceof InventoryError) {
      return {
        ok: false,
        message: error.message,
        fieldErrors:
          error.code === "NEGATIVE_STOCK" || error.code === "INVALID_QUANTITY"
            ? { quantity: error.message }
            : undefined,
      };
    }
    return { ok: false, message: "No se pudo ajustar el stock." };
  }
}

export async function getInventorySummaryAction(
  query: string,
  page = 1,
  perPage = 20,
) {
  await requireUser();
  const safePage = Math.max(1, Math.floor(page));
  const safePerPage = Math.min(100, Math.max(1, Math.floor(perPage)));
  const trimmed = query.trim();

  const { getPrisma } = await import("@/lib/prisma");
  const prisma = getPrisma();
  const where = {
    product: { isActive: true },
    ...(trimmed
      ? {
          OR: [
            { code: { contains: trimmed, mode: "insensitive" as const } },
            { product: { name: { contains: trimmed, mode: "insensitive" as const } } },
            { color: { contains: trimmed, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, variants] = await Promise.all([
    prisma.productVariant.count({ where }),
    prisma.productVariant.findMany({
      where,
      orderBy: { product: { name: "asc" } },
      skip: (safePage - 1) * safePerPage,
      take: safePerPage,
      select: {
        id: true,
        code: true,
        color: true,
        size: true,
        stock: true,
        reservedStock: true,
        soldStock: true,
        status: true,
        product: {
          select: {
            id: true,
            name: true,
            isActive: true,
            category: { select: { id: true, name: true } },
          },
        },
      },
    }),
  ]);

  return {
    items: variants.map((v) => ({
      ...v,
      available: Math.max(0, v.stock - v.reservedStock - v.soldStock),
    })),
    total,
    page: safePage,
    perPage: safePerPage,
    query: trimmed,
  };
}

export type InventoryListItem = Awaited<
  ReturnType<typeof getInventorySummaryAction>
>["items"][number];

export type InventoryListResult = Awaited<
  ReturnType<typeof getInventorySummaryAction>
>;
