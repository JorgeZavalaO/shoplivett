"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, type ImportBatchStatus } from "@prisma/client";
import type { ZodIssue } from "zod";

import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import {
  ImportBatchCreateSchema,
  ImportBatchUpdateSchema,
  ImportBatchItemSchema,
  ImportBatchItemsSchema,
  type ImportBatchCreateInput,
} from "@/lib/validations";
import {
  nextBatchCodeWithRetry,
  listBatches,
  getBatchDetail,
} from "@/lib/import-batches";
import { auditInTx } from "@/lib/audit";
import { getCurrentUser } from "@/lib/permissions";
import {
  calculateLandedCosts,
  calculateTotalInvestmentPenCents,
  CostingError,
} from "@/lib/import-batch-costing";
import { getSettings } from "@/lib/settings";
import { centsToDecimalString, toCents, type Cents } from "@/lib/money";
import { applyBatchStockDelta, assertVariantStockInvariant } from "@/lib/stock-sync";

export type BatchActionResult = {
  ok: boolean;
  message?: string;
  fieldErrors?: Partial<Record<keyof ImportBatchCreateInput | "items", string>>;
};

function fieldErrorsFromZod(
  issues: ZodIssue[],
): BatchActionResult["fieldErrors"] {
  const out: BatchActionResult["fieldErrors"] = {};
  for (const issue of issues) {
    const key = issue.path[0] as keyof ImportBatchCreateInput | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

function readForm(formData: FormData) {
  return {
    purchaseDate: String(formData.get("purchaseDate") ?? "").trim(),
    shopper: String(formData.get("shopper") ?? "").trim(),
    agency: String(formData.get("agency") ?? "").trim(),
    totalCostUsd: String(formData.get("totalCostUsd") ?? "").trim(),
    totalAdditionalCostsUsd: String(formData.get("totalAdditionalCostsUsd") ?? "0").trim(),
    totalAdditionalCostsPen: String(formData.get("totalAdditionalCostsPen") ?? "0").trim(),
    exchangeRate: String(formData.get("exchangeRate") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  };
}

function readItems(formData: FormData) {
  const rawVariants = formData.getAll("variantId");
  const rawQtyPurchased = formData.getAll("quantityPurchased");
  const rawQtyReceived = formData.getAll("quantityReceived");
  const rawUnitCostUsd = formData.getAll("unitCostUsd");
  const rawWeight = formData.getAll("weight");

  const items: Array<{
    variantId: string;
    quantityPurchased: number;
    quantityReceived: number;
    unitCostUsd: string;
    weight: string;
  }> = [];

  for (let i = 0; i < rawVariants.length; i++) {
    const variantId = String(rawVariants[i] ?? "").trim();
    if (!variantId) continue;
    items.push({
      variantId,
      quantityPurchased: Number(rawQtyPurchased[i] ?? 0),
      quantityReceived: Number(rawQtyReceived[i] ?? 0),
      unitCostUsd: String(rawUnitCostUsd[i] ?? "0").trim(),
      weight: String(rawWeight[i] ?? "0").trim(),
    });
  }
  return items;
}

type DraftBatchItem = {
  variantId: string;
  quantityPurchased: number;
  quantityReceived: number;
  unitCostUsd: string;
  weight: string;
  unitCostPen: string;
  subtotalUsd: string;
  subtotalPen: string;
};

function buildDraftBatchItems(
  items: Array<{
    variantId: string;
    quantityPurchased: number;
    quantityReceived: number;
    unitCostUsd: string;
    weight: string;
  }>,
  rate: number,
): {
  items: DraftBatchItem[];
  totalCostUsdCents: Cents;
  totalCostPenCents: Cents;
} {
  let totalCostUsdCents = 0;
  let totalCostPenCents = 0;

  const draftItems = items.map((item) => {
    const unitCostUsdCents = toCents(item.unitCostUsd);
    const subtotalUsdCents = unitCostUsdCents * item.quantityPurchased;
    const subtotalPenCents = toCents((subtotalUsdCents / 100) * rate);
    totalCostUsdCents += subtotalUsdCents;
    totalCostPenCents += subtotalPenCents;
    const unitCostPen =
      item.quantityPurchased > 0
        ? ((subtotalPenCents / item.quantityPurchased) / 100).toFixed(4)
        : "0.0000";

    return {
      ...item,
      unitCostPen,
      subtotalUsd: centsToDecimalString(subtotalUsdCents),
      subtotalPen: centsToDecimalString(subtotalPenCents),
    };
  });

  return {
    items: draftItems,
    totalCostUsdCents,
    totalCostPenCents,
  };
}

function ensureBatchUsdMatchesItems(
  batchTotalUsd: string,
  itemTotalUsdCents: Cents,
): string | null {
  const batchTotalUsdCents = toCents(batchTotalUsd);
  if (batchTotalUsdCents !== itemTotalUsdCents) {
    return `La suma de items (${centsToDecimalString(itemTotalUsdCents)} USD) debe coincidir con el total del lote.`;
  }
  return null;
}

async function resetBatchCostingState(
  tx: Prisma.TransactionClient,
  batchId: string,
): Promise<void> {
  await tx.importBatchItem.updateMany({
    where: { batchId },
    data: {
      additionalCostPen: "0.0000",
      additionalSubtotalPen: "0.00",
      landedUnitCostPen: "0.0000",
      landedSubtotalPen: "0.00",
      distributionBreakdown: Prisma.JsonNull,
      calculatedAt: null,
    },
  });
}

async function syncBatchHeaderFromItems(
  tx: Prisma.TransactionClient,
  batchId: string,
  opts?: {
    exchangeRate?: string | number;
    totalAdditionalCostsUsd?: string | number;
    totalAdditionalCostsPen?: string | number;
  },
): Promise<{ totalCostUsdCents: Cents; totalCostPenCents: Cents; totalInvestmentPenCents: Cents }> {
  const batch = await tx.importBatch.findUnique({
    where: { id: batchId },
    select: {
      exchangeRate: true,
      totalAdditionalCostsUsd: true,
      totalAdditionalCostsPen: true,
      items: {
        select: {
          subtotalUsd: true,
          subtotalPen: true,
        },
      },
    },
  });
  if (!batch) {
    throw new Error("El lote ya no existe.");
  }

  const totalCostUsdCents = batch.items.reduce<number>(
    (sum, item) => sum + toCents(item.subtotalUsd),
    0,
  );
  const totalCostPenCents = batch.items.reduce<number>(
    (sum, item) => sum + toCents(item.subtotalPen),
    0,
  );

  const totalInvestmentPenCents = calculateTotalInvestmentPenCents(
    totalCostPenCents / 100,
    opts?.totalAdditionalCostsUsd ?? batch.totalAdditionalCostsUsd.toString(),
    opts?.totalAdditionalCostsPen ?? batch.totalAdditionalCostsPen.toString(),
    opts?.exchangeRate ?? batch.exchangeRate.toString(),
  );

  await tx.importBatch.update({
    where: { id: batchId },
    data: {
      totalCostUsd: centsToDecimalString(totalCostUsdCents),
      totalInvestmentPen: centsToDecimalString(totalInvestmentPenCents),
      distributionBreakdown: Prisma.JsonNull,
      lastRecalculatedAt: null,
    },
  });

  return { totalCostUsdCents, totalCostPenCents, totalInvestmentPenCents };
}

export async function createBatchAction(
  _prev: BatchActionResult | undefined,
  formData: FormData,
): Promise<BatchActionResult> {
  await requireRole(["ADMIN", "SELLER"]);

  const parsed = ImportBatchCreateSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los datos del formulario.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  const rawItems = readItems(formData);
  const itemsParsed = ImportBatchItemsSchema.safeParse(rawItems);
  if (!itemsParsed.success) {
    const firstIssue = itemsParsed.error.issues[0];
    return {
      ok: false,
      message: firstIssue?.message ?? "Revisa los items del lote.",
      fieldErrors: { items: firstIssue?.message },
    };
  }

  const user = await getCurrentUser();
  const code = await nextBatchCodeWithRetry();
  const prisma = getPrisma();
  const rate = Number(parsed.data.exchangeRate);
  const draft = buildDraftBatchItems(itemsParsed.data, rate);
  const totalMismatch = ensureBatchUsdMatchesItems(
    parsed.data.totalCostUsd,
    draft.totalCostUsdCents,
  );
  if (totalMismatch) {
    return {
      ok: false,
      message: totalMismatch,
      fieldErrors: {
        totalCostUsd: totalMismatch,
        items: totalMismatch,
      },
    };
  }

  const totalInvestmentPenCents = calculateTotalInvestmentPenCents(
    draft.totalCostPenCents / 100,
    parsed.data.totalAdditionalCostsUsd,
    parsed.data.totalAdditionalCostsPen,
    parsed.data.exchangeRate,
  );

  let batchId: string;
  try {
    batchId = await prisma.$transaction(async (tx) => {
      const batch = await tx.importBatch.create({
        data: {
          code,
          purchaseDate: new Date(parsed.data.purchaseDate),
          shopper: parsed.data.shopper,
          agency: parsed.data.agency,
          totalCostUsd: centsToDecimalString(draft.totalCostUsdCents),
          totalAdditionalCostsUsd: parsed.data.totalAdditionalCostsUsd,
          totalAdditionalCostsPen: parsed.data.totalAdditionalCostsPen,
          exchangeRate: parsed.data.exchangeRate,
          totalInvestmentPen: centsToDecimalString(totalInvestmentPenCents),
          notes: parsed.data.notes ?? null,
          createdById: user?.id ?? null,
        },
      });

      for (const item of draft.items) {
        await tx.importBatchItem.create({
          data: {
            batchId: batch.id,
            variantId: item.variantId,
            quantityPurchased: item.quantityPurchased,
            quantityReceived: item.quantityReceived,
            quantityAvailable: item.quantityReceived,
            unitCostUsd: item.unitCostUsd,
            unitCostPen: item.unitCostPen,
            weight: item.weight || "0",
            subtotalUsd: item.subtotalUsd,
            subtotalPen: item.subtotalPen,
          },
        });

        await tx.inventoryMovement.create({
          data: {
            variantId: item.variantId,
            type: "IN",
            quantity: item.quantityReceived,
            reason: `Lote ${code} - Recepción`,
          },
        });

        await applyBatchStockDelta(tx, {
          variantId: item.variantId,
          delta: item.quantityReceived,
          label: `createBatchAction ${code}`,
        });
        await assertVariantStockInvariant(
          tx,
          item.variantId,
          `createBatchAction ${code}`,
        );
      }

      await auditInTx(tx, user?.id ?? null, {
        action: "IMPORT_BATCH_CREATED",
        entity: "ImportBatch",
        entityId: batch.id,
        metadata: {
          code,
          itemsCount: draft.items.length,
          totalInvestmentPen: centsToDecimalString(totalInvestmentPenCents),
        },
      });

      return batch.id;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2034" || error.message.includes("serialization"))
    ) {
      return { ok: false, message: "Conflicto al crear el lote. Intenta nuevamente." };
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, message: "El código del lote ya existe. Intenta nuevamente." };
    }
    throw error;
  }

  revalidatePath("/lotes");
  redirect(`/lotes/${batchId}`);
}

export async function updateBatchAction(
  batchId: string,
  _prev: BatchActionResult | undefined,
  formData: FormData,
): Promise<BatchActionResult> {
  await requireRole(["ADMIN", "SELLER"]);
  if (!batchId) return { ok: false, message: "Falta el identificador del lote." };

  const parsed = ImportBatchUpdateSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los datos del formulario.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  const user = await getCurrentUser();
  const prisma = getPrisma();
  const existing = await prisma.importBatch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      code: true,
      purchaseDate: true,
      shopper: true,
      agency: true,
      totalCostUsd: true,
      totalAdditionalCostsUsd: true,
      totalAdditionalCostsPen: true,
      exchangeRate: true,
      totalInvestmentPen: true,
      status: true,
      notes: true,
      items: {
        select: {
          subtotalUsd: true,
          subtotalPen: true,
        },
      },
    },
  });
  if (!existing) return { ok: false, message: "El lote ya no existe." };
  if (existing.status === "CLOSED") {
    return { ok: false, message: "No puedes modificar un lote cerrado." };
  }

  const currentItemsUsdCents = existing.items.reduce<number>(
    (sum, item) => sum + toCents(item.subtotalUsd),
    0,
  );
  if (parsed.data.totalCostUsd) {
    const totalMismatch = ensureBatchUsdMatchesItems(
      parsed.data.totalCostUsd,
      currentItemsUsdCents,
    );
    if (totalMismatch) {
      return {
        ok: false,
        message: totalMismatch,
        fieldErrors: { totalCostUsd: totalMismatch },
      };
    }
  }

  const updateData: Record<string, unknown> = {};
  const changedFields: Record<string, { from: unknown; to: unknown }> = {};
  if (parsed.data.purchaseDate && new Date(parsed.data.purchaseDate).getTime() !== existing.purchaseDate.getTime()) {
    changedFields.purchaseDate = { from: existing.purchaseDate.toISOString(), to: parsed.data.purchaseDate };
    updateData.purchaseDate = new Date(parsed.data.purchaseDate);
  }
  if (parsed.data.shopper && parsed.data.shopper !== existing.shopper) {
    changedFields.shopper = { from: existing.shopper, to: parsed.data.shopper };
    updateData.shopper = parsed.data.shopper;
  }
  if (parsed.data.agency && parsed.data.agency !== existing.agency) {
    changedFields.agency = { from: existing.agency, to: parsed.data.agency };
    updateData.agency = parsed.data.agency;
  }
  if (parsed.data.totalCostUsd && parsed.data.totalCostUsd !== existing.totalCostUsd.toString()) {
    changedFields.totalCostUsd = { from: existing.totalCostUsd.toString(), to: parsed.data.totalCostUsd };
  }
  if (parsed.data.totalAdditionalCostsUsd !== undefined && parsed.data.totalAdditionalCostsUsd !== existing.totalAdditionalCostsUsd.toString()) {
    changedFields.totalAdditionalCostsUsd = { from: existing.totalAdditionalCostsUsd.toString(), to: parsed.data.totalAdditionalCostsUsd };
    updateData.totalAdditionalCostsUsd = parsed.data.totalAdditionalCostsUsd;
  }
  if (parsed.data.totalAdditionalCostsPen !== undefined && parsed.data.totalAdditionalCostsPen !== existing.totalAdditionalCostsPen.toString()) {
    changedFields.totalAdditionalCostsPen = { from: existing.totalAdditionalCostsPen.toString(), to: parsed.data.totalAdditionalCostsPen };
    updateData.totalAdditionalCostsPen = parsed.data.totalAdditionalCostsPen;
  }
  if (parsed.data.exchangeRate && parsed.data.exchangeRate !== existing.exchangeRate.toString()) {
    changedFields.exchangeRate = { from: existing.exchangeRate.toString(), to: parsed.data.exchangeRate };
    updateData.exchangeRate = parsed.data.exchangeRate;
  }
  if (parsed.data.status && parsed.data.status !== existing.status) {
    changedFields.status = { from: existing.status, to: parsed.data.status };
    updateData.status = parsed.data.status;
  }
  if (parsed.data.notes !== undefined && (parsed.data.notes ?? null) !== existing.notes) {
    changedFields.notes = { from: existing.notes, to: parsed.data.notes ?? null };
    updateData.notes = parsed.data.notes ?? null;
  }

  const headerNeedsSync = Boolean(
    parsed.data.totalCostUsd ||
      parsed.data.totalAdditionalCostsUsd !== undefined ||
      parsed.data.totalAdditionalCostsPen !== undefined ||
      parsed.data.exchangeRate,
  );

  if (Object.keys(updateData).length === 0 && !headerNeedsSync) {
    redirect(`/lotes/${batchId}`);
  }

  const invalidatesCosting = Boolean(
    parsed.data.totalAdditionalCostsUsd !== undefined ||
      parsed.data.totalAdditionalCostsPen !== undefined ||
      parsed.data.exchangeRate,
  );

  await prisma.$transaction(async (tx) => {
    await tx.importBatch.update({
      where: { id: batchId },
      data: updateData,
    });

    if (invalidatesCosting) {
      await resetBatchCostingState(tx, batchId);
    }

    if (headerNeedsSync) {
      await syncBatchHeaderFromItems(tx, batchId, {
        exchangeRate: parsed.data.exchangeRate ?? existing.exchangeRate.toString(),
        totalAdditionalCostsUsd:
          parsed.data.totalAdditionalCostsUsd ?? existing.totalAdditionalCostsUsd.toString(),
        totalAdditionalCostsPen:
          parsed.data.totalAdditionalCostsPen ?? existing.totalAdditionalCostsPen.toString(),
      });
    }

    const hasStatusChange = parsed.data.status && parsed.data.status !== existing.status;
    const hasNonStatusFieldChanges = Object.keys(changedFields).some(
      (key) => key !== "status",
    );

    if (hasStatusChange) {
      await auditInTx(tx, user?.id ?? null, {
        action: "IMPORT_BATCH_STATUS_CHANGED",
        entity: "ImportBatch",
        entityId: batchId,
        metadata: {
          previousStatus: existing.status,
          nextStatus: parsed.data.status,
          code: existing.code,
        },
      });
    }

    if (hasNonStatusFieldChanges) {
      await auditInTx(tx, user?.id ?? null, {
        action: "IMPORT_BATCH_UPDATED",
        entity: "ImportBatch",
        entityId: batchId,
        metadata: {
          code: existing.code,
          changes: changedFields,
        },
      });
    }
  });

  revalidatePath("/lotes");
  revalidatePath(`/lotes/${batchId}`);
  redirect(`/lotes/${batchId}`);
}

export async function addBatchItemAction(
  batchId: string,
  _prev: BatchActionResult | undefined,
  formData: FormData,
): Promise<BatchActionResult> {
  await requireRole(["ADMIN", "SELLER"]);
  if (!batchId) return { ok: false, message: "Falta el identificador del lote." };

  const raw = {
    variantId: String(formData.get("variantId") ?? "").trim(),
    quantityPurchased: formData.get("quantityPurchased"),
    quantityReceived: formData.get("quantityReceived"),
    unitCostUsd: String(formData.get("unitCostUsd") ?? "").trim(),
    weight: String(formData.get("weight") ?? "0").trim(),
  };
  const parsed = ImportBatchItemSchema.safeParse(raw);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return {
      ok: false,
      message: firstIssue?.message ?? "Revisa los datos del item.",
    };
  }

  const user = await getCurrentUser();
  const prisma = getPrisma();

  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    select: { id: true, code: true, exchangeRate: true, status: true },
  });
  if (!batch) return { ok: false, message: "El lote ya no existe." };
  if (batch.status === "CLOSED") {
    return { ok: false, message: "No puedes agregar productos a un lote cerrado." };
  }

  const draft = buildDraftBatchItems(
    [
      {
        variantId: parsed.data.variantId,
        quantityPurchased: parsed.data.quantityPurchased,
        quantityReceived: parsed.data.quantityReceived,
        unitCostUsd: parsed.data.unitCostUsd,
        weight: parsed.data.weight,
      },
    ],
    Number(batch.exchangeRate.toString()),
  ).items[0];

  try {
    await prisma.$transaction(async (tx) => {
      await tx.importBatchItem.create({
        data: {
          batchId: batch.id,
          variantId: draft.variantId,
          quantityPurchased: draft.quantityPurchased,
          quantityReceived: draft.quantityReceived,
          quantityAvailable: draft.quantityReceived,
          unitCostUsd: draft.unitCostUsd,
          unitCostPen: draft.unitCostPen,
          weight: draft.weight || "0",
          subtotalUsd: draft.subtotalUsd,
          subtotalPen: draft.subtotalPen,
        },
      });

      await tx.inventoryMovement.create({
        data: {
          variantId: parsed.data.variantId,
          type: "IN",
          quantity: parsed.data.quantityReceived,
          reason: `Lote ${batch.code} - Item agregado`,
        },
      });

      await applyBatchStockDelta(tx, {
        variantId: parsed.data.variantId,
        delta: parsed.data.quantityReceived,
        label: `addBatchItemAction ${batch.code}`,
      });
      await assertVariantStockInvariant(
        tx,
        parsed.data.variantId,
        `addBatchItemAction ${batch.code}`,
      );

      await auditInTx(tx, user?.id ?? null, {
        action: "IMPORT_BATCH_ITEM_ADDED",
        entity: "ImportBatch",
        entityId: batch.id,
        metadata: {
          code: batch.code,
          variantId: parsed.data.variantId,
        },
      });

      await resetBatchCostingState(tx, batch.id);
      await syncBatchHeaderFromItems(tx, batch.id);
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, message: "Esa variante ya está en el lote." };
    }
    throw error;
  }

  revalidatePath(`/lotes/${batchId}`);
  return { ok: true, message: "Item agregado al lote." };
}

export async function removeBatchItemAction(
  batchId: string,
  itemId: string,
): Promise<void> {
  await requireRole(["ADMIN", "SELLER"]);
  if (!batchId || !itemId) return;

  const user = await getCurrentUser();
  const prisma = getPrisma();

  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    select: { id: true, status: true },
  });
  if (!batch) return;
  if (batch.status === "CLOSED") {
    throw new Error("No puedes eliminar productos de un lote cerrado.");
  }

  const item = await prisma.importBatchItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      variantId: true,
      quantityAvailable: true,
      quantityReceived: true,
      _count: { select: { allocations: true } },
    },
  });
  if (!item) return;

  if (item._count.allocations > 0) {
    throw new Error(
      "No puedes eliminar un item de lote que ya tiene ventas o reservas asociadas.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.importBatchItem.delete({ where: { id: itemId } });

    if (item.quantityAvailable > 0) {
      await tx.inventoryMovement.create({
        data: {
          variantId: item.variantId,
          type: "ADJUSTMENT",
          quantity: -item.quantityAvailable,
          reason: `Lote - Item eliminado (${item.quantityAvailable} uds)` as string,
        },
      });
      await applyBatchStockDelta(tx, {
        variantId: item.variantId,
        delta: -item.quantityAvailable,
        label: `removeBatchItemAction ${batchId}`,
      });
    }
    await assertVariantStockInvariant(
      tx,
      item.variantId,
      `removeBatchItemAction ${batchId}`,
    );

    await auditInTx(tx, user?.id ?? null, {
      action: "IMPORT_BATCH_ITEM_REMOVED",
      entity: "ImportBatch",
      entityId: batchId,
      metadata: { itemId },
    });

    await resetBatchCostingState(tx, batchId);
    await syncBatchHeaderFromItems(tx, batchId);
  });

  revalidatePath(`/lotes/${batchId}`);
}

export async function listBatchesAction(args?: {
  query?: string;
  status?: ImportBatchStatus | "ALL";
  page?: number;
  perPage?: number;
}) {
  await requireRole(["ADMIN", "SELLER"]);
  return listBatches(
    args?.query ?? "",
    args?.status ?? "ALL",
    args?.page ?? 1,
    args?.perPage ?? 20,
  );
}

export async function getBatchDetailAction(batchId: string) {
  await requireRole(["ADMIN", "SELLER"]);
  return getBatchDetail(batchId);
}

export async function searchVariantsForBatchAction(query: string) {
  await requireRole(["ADMIN", "SELLER"]);
  const prisma = getPrisma();
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  const variants = await prisma.productVariant.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { code: { contains: trimmed, mode: "insensitive" } },
        { product: { name: { contains: trimmed, mode: "insensitive" } } },
        { color: { contains: trimmed, mode: "insensitive" } },
      ],
    },
    take: 10,
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      color: true,
      price: true,
      stock: true,
      product: { select: { id: true, name: true } },
    },
  });

  return variants.map((v) => ({
    ...v,
    price: v.price.toString(),
  }));
}

export type RecalculateBatchResult = {
  ok: boolean;
  message?: string;
  totalLandedPen?: string;
  itemCount?: number;
  method?: string;
};

/**
 * Recalcula el costo aterrizado de todos los items de un lote segun el metodo
 * de distribucion configurado en BusinessSettings. Persiste los costos
 * unitarios, subtotales y desglose de distribucion en ImportBatchItem.
 *
 * Sprint 20 (RF-S20-01 a RF-S20-05, RF-S20-07).
 */
export async function recalculateBatchAction(
  batchId: string,
): Promise<RecalculateBatchResult> {
  await requireRole(["ADMIN", "SELLER"]);
  if (!batchId) return { ok: false, message: "Falta el identificador del lote." };

  const user = await getCurrentUser();
  const prisma = getPrisma();

  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      code: true,
      status: true,
      exchangeRate: true,
      totalAdditionalCostsUsd: true,
      totalAdditionalCostsPen: true,
      items: {
        select: {
          id: true,
          unitCostPen: true,
          subtotalPen: true,
          weight: true,
          quantityPurchased: true,
        },
      },
    },
  });
  if (!batch) return { ok: false, message: "El lote ya no existe." };
  if (batch.status === "CLOSED") {
    return { ok: false, message: "No puedes recalcular un lote cerrado." };
  }

  if (batch.items.length === 0) {
    return { ok: false, message: "El lote no tiene items para recalcular." };
  }

  const settings = await getSettings();
  const method = settings.defaultCostAllocationMethod;
  const valuePercent = settings.mixedValueAllocationPercent;
  const weightPercent = settings.mixedWeightAllocationPercent;

  // Mapeo de items a la entrada del motor de costeo.
  const costInputs = batch.items.map((it) => ({
    id: it.id,
    unitCostPen: Number(it.unitCostPen.toString()),
    subtotalPen: Number(it.subtotalPen.toString()),
    weight: Number(it.weight.toString()),
    quantityPurchased: it.quantityPurchased,
  }));

  let result;
  try {
    result = calculateLandedCosts(costInputs, {
      method,
      valuePercent,
      weightPercent,
      totalAdditionalCostsUsd: batch.totalAdditionalCostsUsd.toString(),
      totalAdditionalCostsPen: batch.totalAdditionalCostsPen.toString(),
      exchangeRate: batch.exchangeRate.toString(),
    });
  } catch (err) {
    if (err instanceof CostingError) {
      return {
        ok: false,
        message: `No se pudo recalcular: ${err.message}`,
      };
    }
    throw err;
  }

  const calculatedAt = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      for (const ci of result.items) {
        await tx.importBatchItem.update({
          where: { id: ci.id },
          data: {
            additionalSubtotalPen: ci.additionalSubtotalPen.toFixed(2),
            additionalCostPen: ci.additionalUnitCostPen.toFixed(4),
            landedUnitCostPen: ci.landedUnitCostPen.toFixed(4),
            landedSubtotalPen: ci.landedSubtotalPen.toFixed(2),
            distributionBreakdown: {
              sharePercent: result.breakdown.entries.find((e) => e.itemId === ci.id)?.sharePercent ?? 0,
              additionalSubtotalPen: ci.additionalSubtotalPen,
              additionalUnitCostPen: ci.additionalUnitCostPen,
              landedUnitCostPen: ci.landedUnitCostPen,
              landedSubtotalPen: ci.landedSubtotalPen,
            } as Prisma.InputJsonValue,
            calculatedAt,
          },
        });
      }

      await tx.importBatch.update({
        where: { id: batchId },
        data: {
          distributionMethod: method,
          totalInvestmentPen: result.totalLandedPen.toFixed(2),
          distributionBreakdown: {
            method,
            valuePercent,
            weightPercent,
            totalAdditionalPen: result.breakdown.totalAdditionalPen,
            totalLandedPen: result.totalLandedPen,
          } as Prisma.InputJsonValue,
          lastRecalculatedAt: calculatedAt,
        },
      });

      await auditInTx(tx, user?.id ?? null, {
        action: "IMPORT_BATCH_RECALCULATED",
        entity: "ImportBatch",
        entityId: batchId,
        metadata: {
          code: batch.code,
          method,
          valuePercent,
          weightPercent,
          totalAdditionalPen: result.breakdown.totalAdditionalPen,
          totalLandedPen: result.totalLandedPen,
          itemCount: result.items.length,
        },
      });
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000,
      timeout: 15000,
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      (err.code === "P2034" || err.message.includes("serialization"))
    ) {
      return { ok: false, message: "Conflicto al recalcular. Intenta nuevamente." };
    }
    throw err;
  }

  revalidatePath(`/lotes/${batchId}`);
  revalidatePath("/lotes");

  return {
    ok: true,
    message: "Costos recalculados.",
    totalLandedPen: result.totalLandedPen.toFixed(2),
    itemCount: result.items.length,
    method,
  };
}
