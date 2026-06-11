// Helpers de inventario por variante.
// Operaciones críticas (reserveStock, confirmSaleStock) usan Serializable
// para prevenir race conditions entre reservas simultáneas.

import { Prisma } from "@prisma/client";

import { getPrisma } from "@/lib/prisma";

export class InventoryError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INSUFFICIENT_STOCK"
      | "INSUFFICIENT_RESERVED"
      | "INVALID_QUANTITY"
      | "NEGATIVE_STOCK"
      | "VARIANT_NOT_FOUND"
      | "CONFLICT",
  ) {
    super(message);
    this.name = "InventoryError";
  }
}

export type StockSummary = {
  stock: number;
  reservedStock: number;
  soldStock: number;
  available: number;
};

export type Movement = {
  id: string;
  type: "IN" | "RESERVE" | "RELEASE" | "SALE" | "CANCEL" | "ADJUSTMENT" | "EXPIRE";
  quantity: number;
  reason: string | null;
  createdAt: Date;
};

type Tx = Prisma.TransactionClient;
export type TransactionTx = Tx;

function computeAvailable(
  stock: number,
  reserved: number,
  sold: number,
): number {
  return Math.max(0, stock - reserved - sold);
}

function toStockSummary(v: {
  stock: number;
  reservedStock: number;
  soldStock: number;
}): StockSummary {
  return {
    stock: v.stock,
    reservedStock: v.reservedStock,
    soldStock: v.soldStock,
    available: computeAvailable(v.stock, v.reservedStock, v.soldStock),
  };
}

export async function getStockSummary(
  variantId: string,
): Promise<StockSummary> {
  const prisma = getPrisma();
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { stock: true, reservedStock: true, soldStock: true },
  });
  if (!variant) {
    throw new InventoryError("La variante ya no existe.", "VARIANT_NOT_FOUND");
  }
  return toStockSummary(variant);
}

export async function getStockSummaries(
  variantIds: string[],
): Promise<Map<string, StockSummary>> {
  if (variantIds.length === 0) return new Map();
  const prisma = getPrisma();
  const rows = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    select: { id: true, stock: true, reservedStock: true, soldStock: true },
  });
  const map = new Map<string, StockSummary>();
  for (const row of rows) {
    map.set(row.id, toStockSummary(row));
  }
  return map;
}

// =====================================================================
// Operaciones transaccionales
// =====================================================================

type MovementOptions = {
  reason?: string;
  tx?: Tx;
};

async function findVariantOrThrow(tx: Tx, variantId: string) {
  const v = await tx.productVariant.findUnique({
    where: { id: variantId },
    select: { id: true, stock: true, reservedStock: true, soldStock: true },
  });
  if (!v) {
    throw new InventoryError("La variante ya no existe.", "VARIANT_NOT_FOUND");
  }
  return v;
}

async function recordMovement(
  tx: Tx,
  variantId: string,
  type: Movement["type"],
  quantity: number,
  reason: string | null,
) {
  await tx.inventoryMovement.create({
    data: { variantId, type, quantity, reason },
  });
}

/**
 * Reserva stock: reduce el disponible moviendo unidades a `reservedStock`.
 * Usa Serializable para evitar race conditions.
 */
async function doReserve(
  tx: Tx,
  variantId: string,
  quantity: number,
  reason: string | null,
): Promise<StockSummary> {
  const v = await findVariantOrThrow(tx, variantId);
  const available = computeAvailable(v.stock, v.reservedStock, v.soldStock);
  if (available < quantity) {
    throw new InventoryError(
      `Stock disponible insuficiente (${available} < ${quantity}).`,
      "INSUFFICIENT_STOCK",
    );
  }
  const updated = await tx.productVariant.update({
    where: { id: variantId },
    data: { reservedStock: { increment: quantity } },
    select: { stock: true, reservedStock: true, soldStock: true },
  });
  await recordMovement(tx, variantId, "RESERVE", quantity, reason);
  return toStockSummary(updated);
}

export async function reserveStock(
  variantId: string,
  quantity: number,
  opts: MovementOptions = {},
): Promise<StockSummary> {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new InventoryError(
      "La cantidad a reservar debe ser un entero positivo.",
      "INVALID_QUANTITY",
    );
  }

  if (opts.tx) {
    return doReserve(opts.tx, variantId, quantity, opts.reason ?? null);
  }

  const prisma = getPrisma();
  try {
    return await prisma.$transaction(
      (tx) => doReserve(tx, variantId, quantity, opts.reason ?? null),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 },
    );
  } catch (error) {
    if (error instanceof InventoryError) throw error;
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2034" || error.message.includes("serialization"))
    ) {
      throw new InventoryError(
        "Conflicto de stock: intenta nuevamente.",
        "CONFLICT",
      );
    }
    throw error;
  }
}

/** Libera stock reservado (cancelación, recordatorio). */
export async function releaseStock(
  variantId: string,
  quantity: number,
  opts: MovementOptions = {},
): Promise<StockSummary> {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new InventoryError(
      "La cantidad a liberar debe ser un entero positivo.",
      "INVALID_QUANTITY",
    );
  }
  const doRelease = async (tx: Tx) => {
    const v = await findVariantOrThrow(tx, variantId);
    if (v.reservedStock < quantity) {
      throw new InventoryError(
        `Stock reservado insuficiente (${v.reservedStock} < ${quantity}).`,
        "INSUFFICIENT_RESERVED",
      );
    }
    const updated = await tx.productVariant.update({
      where: { id: variantId },
      data: { reservedStock: { decrement: quantity } },
      select: { stock: true, reservedStock: true, soldStock: true },
    });
    await recordMovement(tx, variantId, "RELEASE", quantity, opts.reason ?? null);
    return toStockSummary(updated);
  };
  if (opts.tx) {
    return doRelease(opts.tx);
  }
  return getPrisma().$transaction(doRelease, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 5000,
    timeout: 10000,
  });
}

/** Confirma la venta: mueve de reservado a vendido. */
export async function confirmSaleStock(
  variantId: string,
  quantity: number,
  opts: MovementOptions = {},
): Promise<StockSummary> {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new InventoryError(
      "La cantidad a confirmar debe ser un entero positivo.",
      "INVALID_QUANTITY",
    );
  }
  const doConfirm = async (tx: Tx) => {
    const v = await findVariantOrThrow(tx, variantId);
    if (v.reservedStock < quantity) {
      throw new InventoryError(
        `Stock reservado insuficiente para confirmar la venta (${v.reservedStock} < ${quantity}).`,
        "INSUFFICIENT_RESERVED",
      );
    }
    const updated = await tx.productVariant.update({
      where: { id: variantId },
      data: {
        reservedStock: { decrement: quantity },
        soldStock: { increment: quantity },
      },
      select: { stock: true, reservedStock: true, soldStock: true },
    });
    await recordMovement(tx, variantId, "SALE", quantity, opts.reason ?? null);
    return toStockSummary(updated);
  };
  if (opts.tx) {
    return doConfirm(opts.tx);
  }
  try {
    return await getPrisma().$transaction(doConfirm, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000,
      timeout: 10000,
    });
  } catch (error) {
    if (error instanceof InventoryError) throw error;
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2034" || error.message.includes("serialization"))
    ) {
      throw new InventoryError(
        "Conflicto de stock: intenta nuevamente.",
        "CONFLICT",
      );
    }
    throw error;
  }
}

/** Cancela stock sin reserva previa (caso de error antes de reservar). */
export async function cancelStock(
  variantId: string,
  quantity: number,
  opts: MovementOptions = {},
): Promise<StockSummary> {
  // Para cancel sin reserva, ajustamos manualmente con un movimiento CANCEL.
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new InventoryError(
      "La cantidad a cancelar debe ser un entero positivo.",
      "INVALID_QUANTITY",
    );
  }
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    await findVariantOrThrow(tx, variantId);
    await recordMovement(tx, variantId, "CANCEL", quantity, opts.reason ?? null);
    const updated = await tx.productVariant.findUniqueOrThrow({
      where: { id: variantId },
      select: { stock: true, reservedStock: true, soldStock: true },
    });
    return toStockSummary(updated);
  });
}

/**
 * Ajusta el stock manualmente. Para type=IN suma al stock total; para
 * type=ADJUSTMENT puede sumar (positivo) o restar (negativo).
 * Crea un movimiento con el motivo obligatorio.
 */
export async function adjustStock(
  variantId: string,
  signedQuantity: number,
  reason: string,
): Promise<StockSummary> {
  if (!Number.isInteger(signedQuantity) || signedQuantity === 0) {
    throw new InventoryError(
      "La cantidad debe ser un entero distinto de cero.",
      "INVALID_QUANTITY",
    );
  }
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    const v = await findVariantOrThrow(tx, variantId);
    const newStock = v.stock + signedQuantity;
    if (newStock < 0) {
      throw new InventoryError(
        `El ajuste dejaría el stock en ${newStock}. No se permite stock negativo.`,
        "NEGATIVE_STOCK",
      );
    }
    const updated = await tx.productVariant.update({
      where: { id: variantId },
      data: { stock: newStock },
      select: { stock: true, reservedStock: true, soldStock: true },
    });
    await recordMovement(
      tx,
      variantId,
      signedQuantity > 0 ? "IN" : "ADJUSTMENT",
      signedQuantity,
      reason,
    );
    return toStockSummary(updated);
  });
}

// =====================================================================
// Historial
// =====================================================================

export async function getMovementHistory(variantId: string): Promise<Movement[]> {
  const prisma = getPrisma();
  const rows = await prisma.inventoryMovement.findMany({
    where: { variantId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((m) => ({
    id: m.id,
    type: m.type,
    quantity: m.quantity,
    reason: m.reason,
    createdAt: m.createdAt,
  }));
}
