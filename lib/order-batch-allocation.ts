// Sprint 21 - Integración lote-stock-venta FIFO.
//
// Reserva stock por lote de forma FIFO y congela snapshots financieros
// en `OrderItem` y `Order`. Mantiene la separación de responsabilidades:
//   - `allocateOrderItemBatches`: consume FIFO y crea filas de asignación.
//   - `releaseOrderItemAllocations`: devuelve unidades al lote en cancelaciones.
//   - `distributeOrderDiscount`: reparte el descuento del pedido entre líneas
//     usando `largest remainder` para que la suma cierre al centavo.
//   - `recognizeOrderProfit`: al pasar a `PAID`, congela utilidad bruta y neta.
//
// Si la variante "opera con lotes" (tiene al menos un item con costo aterrizado
// o stock disponible), la venta exige lote. En caso contrario, se usa el
// snapshot legado `ProductVariant.cost`.
//
// Todas las funciones reciben una transacción Prisma (`tx`) cuando aplica, para
// mantener la atomicidad con `createQuickSale`, `validatePayment` o
// `closeUnpaidReservation`.

import { Prisma, type OrderItemCostSource, type SalesChannel } from "@prisma/client";

import {
  toCents,
  toTenThousandths,
  tenThousandthsToCents,
  centsToDecimalString,
  type Cents,
} from "@/lib/money";
import { applyBatchStockDelta, assertVariantStockInvariant } from "@/lib/stock-sync";

export class BatchAllocationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INSUFFICIENT_BATCH_STOCK"
      | "VARIANT_NOT_FOUND"
      | "BATCH_NOT_CALCULATED"
      | "INVALID_QUANTITY"
      | "CONFLICT",
  ) {
    super(message);
    this.name = "BatchAllocationError";
  }
}

type Tx = Prisma.TransactionClient;

export type CostSource = OrderItemCostSource;

export type AllocatedRow = {
  batchItemId: string;
  batchId: string;
  variantId: string;
  quantity: number;
  unitCostPen: string;
  subtotalCostPen: string;
};

export type OrderLinePricing = {
  variantId: string;
  quantity: number;
  unitPrice: string;
  lineSubtotalCents: Cents;
  lineDiscountCents: Cents;
  netLineRevenueCents: Cents;
};

export type LineSnapshot = {
  variantId: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  lineDiscountPen: string;
  netLineRevenuePen: string;
  costSource: CostSource;
  unitCostPen: string;
  totalCostPen: string;
  grossProfitPen: string;
  allocations: AllocatedRow[];
};

/**
 * Indica si la variante ya opera con lotes de importación. Se considera
 * "con lotes" si tiene al menos un `ImportBatchItem` registrado, sin
 * importar el stock disponible. Esto permite distinguir fallback legado
 * vs FIFO de manera estable entre ventas.
 */
export async function variantOperatesWithBatches(
  tx: Tx,
  variantId: string,
): Promise<boolean> {
  const count = await tx.importBatchItem.count({
    where: { variantId },
  });
  return count > 0;
}

function decString(value: { toString(): string }): string {
  return value.toString();
}

/**
 * Verifica que una variante tenga stock de lote suficiente. Si la variante
 * no opera con lotes, no realiza ninguna verificación.
 */
export async function checkBatchStock(
  tx: Tx,
  variantId: string,
  quantity: number,
): Promise<void> {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new BatchAllocationError(
      "La cantidad a asignar debe ser un entero positivo.",
      "INVALID_QUANTITY",
    );
  }
  const operates = await variantOperatesWithBatches(tx, variantId);
  if (!operates) return;

  const rows = await tx.importBatchItem.findMany({
    where: {
      variantId,
      quantityAvailable: { gt: 0 },
      calculatedAt: { not: null },
    },
    select: { quantityAvailable: true },
  });
  const total = rows.reduce((acc, r) => acc + r.quantityAvailable, 0);
  if (total < quantity) {
    throw new BatchAllocationError(
      `Stock por lote insuficiente para la variante (${total} < ${quantity}).`,
      "INSUFFICIENT_BATCH_STOCK",
    );
  }
}

/**
 * Asigna stock FIFO de uno o más `ImportBatchItem` a un `OrderItem` recién
 * creado. Devuelve las filas a persistir en `OrderItemBatchAllocation` y
 * actualiza `quantityAvailable` con `updateMany` condicional para evitar
 * sobreasignación bajo concurrencia.
 */
export async function allocateOrderItemBatches(
  tx: Tx,
  orderItemId: string,
  variantId: string,
  quantity: number,
): Promise<AllocatedRow[]> {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new BatchAllocationError(
      "La cantidad a asignar debe ser un entero positivo.",
      "INVALID_QUANTITY",
    );
  }

  const operates = await variantOperatesWithBatches(tx, variantId);
  if (!operates) return [];

  const candidates = await tx.importBatchItem.findMany({
    where: {
      variantId,
      quantityAvailable: { gt: 0 },
      calculatedAt: { not: null },
    },
    orderBy: [
      { batch: { purchaseDate: "asc" } },
      { batch: { createdAt: "asc" } },
      { createdAt: "asc" },
    ],
    select: {
      id: true,
      batchId: true,
      variantId: true,
      quantityAvailable: true,
      landedUnitCostPen: true,
    },
  });

  let remaining = quantity;
  const allocations: AllocatedRow[] = [];

  for (const candidate of candidates) {
    if (remaining <= 0) break;
    const available = candidate.quantityAvailable;
    if (available <= 0) continue;
    const take = Math.min(available, remaining);
    const unitCostPen = decString(candidate.landedUnitCostPen);
    const unitCostTenThousandths = toTenThousandths(unitCostPen, { allowNegative: true });
    const subtotalCents = tenThousandthsToCents(unitCostTenThousandths * take);
    const subtotalCostPen = centsToDecimalString(subtotalCents);

    const update = await tx.importBatchItem.updateMany({
      where: { id: candidate.id, quantityAvailable: { gte: take } },
      data: { quantityAvailable: { decrement: take } },
    });
    if (update.count !== 1) {
      throw new BatchAllocationError(
        "Conflicto al asignar stock por lote. Intenta nuevamente.",
        "CONFLICT",
      );
    }

    await tx.orderItemBatchAllocation.create({
      data: {
        orderItemId,
        batchItemId: candidate.id,
        batchId: candidate.batchId,
        variantId: candidate.variantId,
        quantity: take,
        unitCostPen,
        subtotalCostPen,
      },
    });

    await applyBatchStockDelta(tx, {
      variantId: candidate.variantId,
      delta: -take,
      label: `allocateOrderItemBatches ${orderItemId}`,
    });

    allocations.push({
      batchItemId: candidate.id,
      batchId: candidate.batchId,
      variantId: candidate.variantId,
      quantity: take,
      unitCostPen,
      subtotalCostPen,
    });

    remaining -= take;
  }

  if (remaining > 0) {
    throw new BatchAllocationError(
      `Stock por lote insuficiente para la variante (faltan ${remaining} uds).`,
      "INSUFFICIENT_BATCH_STOCK",
    );
  }

  await assertVariantStockInvariant(tx, variantId, "allocateOrderItemBatches");

  return allocations;
}

/**
 * Libera todas las asignaciones de un OrderItem devolviendo unidades a
 * `ImportBatchItem.quantityAvailable`. Pensado para cancelaciones o
 * vencimientos de reservas no pagadas.
 */
export async function releaseOrderItemAllocations(
  tx: Tx,
  orderItemId: string,
): Promise<{ batchItemId: string; quantity: number }[]> {
  const allocations = await tx.orderItemBatchAllocation.findMany({
    where: { orderItemId },
    select: { id: true, batchItemId: true, quantity: true, variantId: true },
  });
  const released: { batchItemId: string; quantity: number }[] = [];
  const deltaByVariant = new Map<string, number>();
  for (const alloc of allocations) {
    await tx.importBatchItem.update({
      where: { id: alloc.batchItemId },
      data: { quantityAvailable: { increment: alloc.quantity } },
    });
    released.push({ batchItemId: alloc.batchItemId, quantity: alloc.quantity });
    deltaByVariant.set(
      alloc.variantId,
      (deltaByVariant.get(alloc.variantId) ?? 0) + alloc.quantity,
    );
  }
  for (const [variantId, delta] of deltaByVariant) {
    await applyBatchStockDelta(tx, {
      variantId,
      delta,
      label: `releaseOrderItemAllocations ${orderItemId}`,
    });
    await assertVariantStockInvariant(
      tx,
      variantId,
      `releaseOrderItemAllocations ${orderItemId}`,
    );
  }
  if (allocations.length > 0) {
    await tx.orderItemBatchAllocation.deleteMany({ where: { orderItemId } });
  }
  return released;
}

/**
 * Distribuye un descuento total del pedido entre sus líneas de forma
 * proporcional al subtotal, aplicando `largest remainder` para que la suma
 * de descuentos asignados sea exactamente el descuento original.
 */
export function distributeOrderDiscount<
  T extends { variantId: string; quantity: number; lineSubtotalCents: Cents },
>(
  lines: T[],
  totalDiscountCents: Cents,
): Map<string, Cents> {
  const map = new Map<string, Cents>();
  if (lines.length === 0 || totalDiscountCents <= 0) {
    for (const l of lines) map.set(l.variantId, 0);
    return map;
  }
  const totalSubtotalCents = lines.reduce(
    (acc, l) => acc + l.lineSubtotalCents,
    0,
  );
  if (totalSubtotalCents <= 0) {
    for (const l of lines) map.set(l.variantId, 0);
    return map;
  }
  const raw = lines.map((l) => ({
    variantId: l.variantId,
    base: Math.floor((l.lineSubtotalCents * totalDiscountCents) / totalSubtotalCents),
    remainder:
      ((l.lineSubtotalCents * totalDiscountCents) % totalSubtotalCents) /
      Math.max(1, totalSubtotalCents),
  }));
  const allocated = raw.reduce((acc, r) => acc + r.base, 0);
  let leftover = totalDiscountCents - allocated;
  if (leftover > 0) {
    const ordered = [...raw]
      .map((r, i) => ({ ...r, idx: i }))
      .sort((a, b) => b.remainder - a.remainder);
    for (const r of ordered) {
      if (leftover <= 0) break;
      raw[r.idx].base += 1;
      leftover -= 1;
    }
  } else if (leftover < 0) {
    const ordered = [...raw]
      .map((r, i) => ({ ...r, idx: i }))
      .sort((a, b) => a.remainder - b.remainder);
    for (const r of ordered) {
      if (leftover >= 0) break;
      raw[r.idx].base -= 1;
      leftover += 1;
    }
  }
  for (const r of raw) {
    map.set(r.variantId, r.base);
  }
  return map;
}

/**
 * Resuelve el costo unitario legado (sin lote) a partir de `ProductVariant.cost`.
 */
function resolveLegacyUnitCost(
  variantCost: { toString(): string } | null | undefined,
): { unitCostPen: string; unitCostCents: Cents } {
  const raw = variantCost ? variantCost.toString() : "0";
  const cents = toCents(raw, { allowNegative: true });
  if (cents <= 0) {
    return { unitCostPen: "0.0000", unitCostCents: 0 };
  }
  return { unitCostPen: (cents / 100).toFixed(4), unitCostCents: cents };
}

/**
 * Construye los snapshots de `OrderItem` a partir de las líneas, descuentos y
 * asignaciones de lote. El ingreso neto por línea descuenta el reparto
 * proporcional de descuento y se redondea a centavos. La utilidad bruta por
 * línea es `netLineRevenue - totalCost`; si el costo es legado, se aplica
 * `ProductVariant.cost`.
 */
export function buildLineSnapshots(args: {
  lines: Array<{
    id: string;
    variantId: string;
    quantity: number;
    unitPrice: string;
    variant: { cost: { toString(): string } | null };
    allocations: AllocatedRow[];
  }>;
  discountCents: Cents;
}): Array<{
  orderItemId: string;
  lineTotal: string;
  lineDiscountPen: string;
  netLineRevenuePen: string;
  costSource: CostSource;
  unitCostPen: string;
  totalCostPen: string;
  grossProfitPen: string;
}> {
  const lineInputs = args.lines.map((l) => {
    const unitPriceCents = toCents(l.unitPrice, { allowNegative: true });
    const lineSubtotalCents = unitPriceCents * l.quantity;
    return { ...l, unitPriceCents, lineSubtotalCents };
  });
  const discountByVariant = distributeOrderDiscount(
    lineInputs.map((l) => ({
      variantId: l.id,
      quantity: l.quantity,
      lineSubtotalCents: l.lineSubtotalCents,
    })),
    args.discountCents,
  );
  return lineInputs.map((l) => {
    const lineDiscountCents = discountByVariant.get(l.id) ?? 0;
    const netRevenueCents = Math.max(
      0,
      l.lineSubtotalCents - lineDiscountCents,
    );
    let costSource: CostSource = "NONE";
    let unitCostCents: Cents = 0;
    let unitCostPen: string;
    if (l.allocations.length > 0) {
      costSource = "BATCH";
      const totalCents = l.allocations.reduce(
        (acc, a) => acc + toCents(a.subtotalCostPen, { allowNegative: true }),
        0,
      );
      const perUnit =
        l.quantity > 0
          ? Number((totalCents / l.quantity / 100).toFixed(4))
          : 0;
      unitCostPen = perUnit.toFixed(4);
      unitCostCents = totalCents;
    } else {
      const legacy = resolveLegacyUnitCost(l.variant.cost);
      if (legacy.unitCostCents > 0) {
        costSource = "LEGACY";
        unitCostPen = legacy.unitCostPen;
        unitCostCents = legacy.unitCostCents;
      } else {
        costSource = "NONE";
        unitCostPen = "0.0000";
        unitCostCents = 0;
      }
    }
    const totalCostCents = Math.round(unitCostCents * l.quantity);
    const grossProfitCents = netRevenueCents - totalCostCents;
    return {
      orderItemId: l.id,
      lineTotal: centsToDecimalString(netRevenueCents),
      lineDiscountPen: centsToDecimalString(lineDiscountCents),
      netLineRevenuePen: centsToDecimalString(netRevenueCents),
      costSource,
      unitCostPen,
      totalCostPen: centsToDecimalString(totalCostCents),
      grossProfitPen: centsToDecimalString(grossProfitCents),
    };
  });
}

/**
 * Reconoce la utilidad de un pedido en estado `PAID`. Idempotente: si ya
 * existe `profitCalculatedAt`, no recalcula (cumple RF-S21-05 y snapshot
 * histórico). Costo real por línea viene de `OrderItem.totalCostPen`.
 */
export async function recognizeOrderProfit(
  tx: Tx,
  orderId: string,
  opts: {
    paymentMethodFees: Record<string, number>;
    packagingCostPen: string;
  },
): Promise<{
  productCostCents: Cents;
  grossProfitCents: Cents;
  paymentFeeCents: Cents;
  packagingCostCents: Cents;
  netProfitCents: Cents;
}> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      total: true,
      profitCalculatedAt: true,
      productCostPen: true,
      grossProfitPen: true,
      paymentFeePen: true,
      packagingCostPen: true,
      netProfitPen: true,
      payments: {
        where: { status: "VALIDATED" },
        select: { method: true, amount: true },
      },
      items: {
        select: {
          totalCostPen: true,
          grossProfitPen: true,
        },
      },
    },
  });
  if (!order) {
    throw new Error("El pedido ya no existe.");
  }
  if (order.status !== "PAID") {
    throw new Error("Solo puedes reconocer utilidad en pedidos pagados.");
  }

  // Guard de idempotencia: si ya se reconoció utilidad, no recalcular ni
  // pisar los snapshots existentes.
  if (order.profitCalculatedAt) {
    return {
      productCostCents: toCents(order.productCostPen.toString(), {
        allowNegative: true,
      }),
      grossProfitCents: toCents(order.grossProfitPen.toString(), {
        allowNegative: true,
      }),
      paymentFeeCents: toCents(order.paymentFeePen.toString(), {
        allowNegative: true,
      }),
      packagingCostCents: toCents(order.packagingCostPen.toString(), {
        allowNegative: true,
      }),
      netProfitCents: toCents(order.netProfitPen.toString(), {
        allowNegative: true,
      }),
    };
  }

  const productCostCents = order.items.reduce(
    (acc, it) => acc + toCents(it.totalCostPen.toString(), { allowNegative: true }),
    0,
  );
  const grossProfitCents = order.items.reduce(
    (acc, it) => acc + toCents(it.grossProfitPen.toString(), { allowNegative: true }),
    0,
  );
  const paymentFeeCents = order.payments.reduce((acc, p) => {
    const amountCents = toCents(p.amount.toString(), { allowNegative: true });
    const bps = opts.paymentMethodFees[p.method] ?? 0;
    return acc + Math.floor((amountCents * bps) / 10000);
  }, 0);
  const packagingCostCents = toCents(opts.packagingCostPen, {
    allowNegative: true,
  });
  const netProfitCents = grossProfitCents - paymentFeeCents - packagingCostCents;

  await tx.order.update({
    where: { id: orderId },
    data: {
      productCostPen: centsToDecimalString(productCostCents),
      grossProfitPen: centsToDecimalString(grossProfitCents),
      paymentFeePen: centsToDecimalString(paymentFeeCents),
      packagingCostPen: centsToDecimalString(packagingCostCents),
      netProfitPen: centsToDecimalString(netProfitCents),
      profitCalculatedAt: new Date(),
    },
  });

  return {
    productCostCents,
    grossProfitCents,
    paymentFeeCents,
    packagingCostCents,
    netProfitCents,
  };
}

/**
 * Construye el objeto de OrderItem con sus snapshots y crea la fila. Pensado
 * para ser llamado dentro de la transacción de `createQuickSale`.
 */
export type QuickSaleItemInput = {
  variantId: string;
  quantity: number;
  unitPrice: string;
  variant: { cost: { toString(): string } | null };
};

export type QuickSaleAllocationResult = {
  orderItemId: string;
  lineTotal: string;
  lineDiscountPen: string;
  netLineRevenuePen: string;
  costSource: CostSource;
  unitCostPen: string;
  totalCostPen: string;
  grossProfitPen: string;
  allocations: AllocatedRow[];
};

export async function persistQuickSaleLine(args: {
  tx: Tx;
  orderId: string;
  item: QuickSaleItemInput;
  lineDiscountCents?: Cents;
  shippingAllocationCents?: Cents;
}): Promise<QuickSaleAllocationResult> {
  const { tx, orderId, item } = args;
  const lineDiscountCents: Cents = Math.max(0, args.lineDiscountCents ?? 0);
  const shippingAllocationCents: Cents = Math.max(
    0,
    args.shippingAllocationCents ?? 0,
  );
  const lineSubtotalCents =
    toCents(item.unitPrice, { allowNegative: true }) * item.quantity;
  const lineNetCents = Math.max(
    0,
    lineSubtotalCents - lineDiscountCents + shippingAllocationCents,
  );

  const orderItem = await tx.orderItem.create({
    data: {
      orderId,
      variantId: item.variantId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: centsToDecimalString(lineSubtotalCents),
    },
    select: { id: true },
  });

  const allocations = await allocateOrderItemBatches(
    tx,
    orderItem.id,
    item.variantId,
    item.quantity,
  );

  let costSource: CostSource = "NONE";
  let unitCostPen = "0.0000";
  let totalCostCents: Cents = 0;
  if (allocations.length > 0) {
    costSource = "BATCH";
    const totalCents = allocations.reduce(
      (acc, a) => acc + toCents(a.subtotalCostPen, { allowNegative: true }),
      0,
    );
    const perUnit =
      item.quantity > 0
        ? Number((totalCents / item.quantity / 100).toFixed(4))
        : 0;
    unitCostPen = perUnit.toFixed(4);
    totalCostCents = totalCents;
  } else {
    const legacy = resolveLegacyUnitCost(item.variant.cost);
    if (legacy.unitCostCents > 0) {
      costSource = "LEGACY";
      unitCostPen = legacy.unitCostPen;
      totalCostCents = legacy.unitCostCents;
    }
  }

  const totalCostCentsRounded = Math.round(totalCostCents);
  const grossProfitCents = lineNetCents - totalCostCentsRounded;

  await tx.orderItem.update({
    where: { id: orderItem.id },
    data: {
      costSource,
      unitCostPen,
      totalCostPen: centsToDecimalString(totalCostCentsRounded),
      netLineRevenuePen: centsToDecimalString(lineNetCents),
      lineDiscountPen: centsToDecimalString(lineDiscountCents),
      grossProfitPen: centsToDecimalString(grossProfitCents),
    },
  });

  return {
    orderItemId: orderItem.id,
    lineTotal: centsToDecimalString(lineSubtotalCents),
    lineDiscountPen: centsToDecimalString(lineDiscountCents),
    netLineRevenuePen: centsToDecimalString(lineNetCents),
    costSource,
    unitCostPen,
    totalCostPen: centsToDecimalString(totalCostCentsRounded),
    grossProfitPen: centsToDecimalString(grossProfitCents),
    allocations,
  };
}

/**
 * Helper de selección consistente para `OrderItemBatchAllocation`.
 */
export const ORDER_ITEM_ALLOCATION_SELECT = {
  id: true,
  batchItemId: true,
  batchId: true,
  variantId: true,
  quantity: true,
  unitCostPen: true,
  subtotalCostPen: true,
  createdAt: true,
} as const;

/**
 * Lista los canales de venta disponibles (helper de reuso).
 */
export function isSalesChannel(value: string): value is SalesChannel {
  return (
    value === "TIKTOK_LIVE" ||
    value === "INSTAGRAM_LIVE" ||
    value === "TIENDA" ||
    value === "WHATSAPP_DIRECTO" ||
    value === "OTRO"
  );
}
