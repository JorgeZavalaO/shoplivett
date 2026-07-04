// Modulo de agregadores financieros para el Dashboard (Sprint 24).
//
// Combina ventas PAID con gastos operativos, perdidas por incidencias,
// costo de stock y capital inmovilizado en lotes abiertos para responder
// las preguntas del negocio: cuanto gane, cuanto tengo en stock, que lote
// es rentable, que producto no rota, etc.
//
// Reglas:
//   - Todas las agregaciones usan `select` minimo para no arrastrar PII.
//   - Todo dinero se maneja en centavos enteros (`Cents`).
//   - No se cachean datos financieros sensibles en este modulo.
//   - Si no se pasa year/month, se asume el periodo en curso.
//
// Los filtros `salesChannel`, `batchId` y `categoryId` se aplican a las
// ventas (no a gastos ni a stock valorizado). El periodo se aplica a
// ventas, gastos y perdidas por igual.

import { type Prisma, SalesChannel } from "@prisma/client";

import { getPrisma } from "@/lib/prisma";
import { centsToDecimalString, toCents, type Cents } from "@/lib/money";

export { LOW_ROTATION_THRESHOLD_DAYS, DEFAULT_TOP_PRODUCTS_LIMIT } from "@/lib/financial-dashboard-shared";

export type FinancialDashboardFilter = {
  year?: number;
  month?: number; // 1-12
  salesChannel?: SalesChannel | "ALL";
  batchId?: string | "ALL";
  categoryId?: string | "ALL";
};

function empty<T>(v: T | null | undefined, fallback: T): T {
  return v === null || v === undefined ? fallback : v;
}

void empty;

export function monthRange(year: number, month: number): { gte: Date; lte: Date } {
  const gte = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const lastDay = new Date(year, month, 0).getDate();
  const lte = new Date(year, month - 1, lastDay, 23, 59, 59, 999);
  return { gte, lte };
}

function resolveCurrentPeriod(now: Date = new Date()): { year: number; month: number } {
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function buildOrderWhere(
  range: { gte: Date; lte: Date },
  filter: FinancialDashboardFilter,
): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {
    status: "PAID",
    profitCalculatedAt: { gte: range.gte, lte: range.lte },
  };
  if (filter.salesChannel && filter.salesChannel !== "ALL") {
    where.salesChannel = filter.salesChannel;
  }
  if (filter.batchId && filter.batchId !== "ALL") {
    where.items = {
      some: { allocations: { some: { batchId: filter.batchId } } },
    };
  }
  if (filter.categoryId && filter.categoryId !== "ALL") {
    where.items = {
      ...(where.items as Prisma.OrderItemListRelationFilter | undefined),
      some: {
        ...((where.items as { some?: Record<string, unknown> } | undefined)?.some ?? {}),
        variant: { product: { categoryId: filter.categoryId } },
      },
    };
  }
  return where;
}

// =====================================================================
// Overview financiero del periodo (RF-S24-01 a RF-S24-06)
// =====================================================================

export type FinancialOverview = {
  year: number;
  month: number;
  filter: FinancialDashboardFilter;
  revenueCents: Cents;
  revenue: string;
  productCostCents: Cents;
  productCost: string;
  grossProfitCents: Cents;
  grossProfit: string;
  paymentFeeCents: Cents;
  paymentFee: string;
  packagingCostCents: Cents;
  packagingCost: string;
  netProfitCents: Cents;
  netProfit: string;
  expensesCents: Cents;
  expenses: string;
  incidentLossCents: Cents;
  incidentLoss: string;
  realNetProfitCents: Cents;
  realNetProfit: string;
  marginBps: number;
  ordersCount: number;
};

export async function getFinancialOverview(
  filter: FinancialDashboardFilter = {},
): Promise<FinancialOverview> {
  const prisma = getPrisma();
  const { year, month } = {
    ...resolveCurrentPeriod(),
    ...(filter.year && filter.month ? { year: filter.year, month: filter.month } : {}),
  };
  const range = monthRange(year, month);
  const orderWhere = buildOrderWhere(range, filter);

  const [
    revenueAgg,
    productCostAgg,
    grossProfitAgg,
    paymentFeeAgg,
    packagingAgg,
    ordersCount,
    expensesAgg,
    incidentLossAgg,
  ] = await Promise.all([
    prisma.order.aggregate({ where: orderWhere, _sum: { total: true } }),
    prisma.order.aggregate({ where: orderWhere, _sum: { productCostPen: true } }),
    prisma.order.aggregate({ where: orderWhere, _sum: { grossProfitPen: true } }),
    prisma.order.aggregate({ where: orderWhere, _sum: { paymentFeePen: true } }),
    prisma.order.aggregate({ where: orderWhere, _sum: { packagingCostPen: true } }),
    prisma.order.count({ where: orderWhere }),
    prisma.expense.aggregate({
      where: { status: "ACTIVE", expenseDate: { gte: range.gte, lte: range.lte } },
      _sum: { amount: true },
    }),
    prisma.incident.aggregate({
      where: { status: { not: "CANCELLED" }, incidentDate: { gte: range.gte, lte: range.lte } },
      _sum: { lostAmount: true },
    }),
  ]);

  const revenueCents = toCents(revenueAgg._sum.total);
  const productCostCents = toCents(productCostAgg._sum.productCostPen, { allowNegative: true });
  const grossProfitCents = toCents(grossProfitAgg._sum.grossProfitPen, { allowNegative: true });
  const paymentFeeCents = toCents(paymentFeeAgg._sum.paymentFeePen, { allowNegative: true });
  const packagingCostCents = toCents(packagingAgg._sum.packagingCostPen, { allowNegative: true });
  const expensesCents = toCents(expensesAgg._sum.amount);
  const incidentLossCents = toCents(incidentLossAgg._sum.lostAmount, { allowNegative: true });

  const netProfitCents = grossProfitCents - paymentFeeCents - packagingCostCents;
  const realNetProfitCents = netProfitCents - expensesCents - incidentLossCents;
  const marginBps =
    revenueCents > 0
      ? Math.round((realNetProfitCents * 10000) / revenueCents)
      : 0;

  return {
    year,
    month,
    filter,
    revenueCents,
    revenue: centsToDecimalString(revenueCents),
    productCostCents,
    productCost: centsToDecimalString(productCostCents),
    grossProfitCents,
    grossProfit: centsToDecimalString(grossProfitCents),
    paymentFeeCents,
    paymentFee: centsToDecimalString(paymentFeeCents),
    packagingCostCents,
    packagingCost: centsToDecimalString(packagingCostCents),
    netProfitCents,
    netProfit: centsToDecimalString(netProfitCents),
    expensesCents,
    expenses: centsToDecimalString(expensesCents),
    incidentLossCents,
    incidentLoss: centsToDecimalString(incidentLossCents),
    realNetProfitCents,
    realNetProfit: centsToDecimalString(realNetProfitCents),
    marginBps,
    ordersCount,
  };
}

// =====================================================================
// Valor del stock actual a costo aterrizado (RF-S24-07)
// =====================================================================

export type StockValuation = {
  totalUnits: number;
  totalCents: Cents;
  total: string;
  byCategory: Array<{
    categoryId: string;
    categoryName: string;
    units: number;
    totalCents: Cents;
    total: string;
  }>;
  variantsWithBatches: number;
  variantsWithoutBatches: number;
  fallbackLegacyValueCents: Cents;
  fallbackLegacyValue: string;
};

export async function getStockValuation(): Promise<StockValuation> {
  const prisma = getPrisma();

  const variants = await prisma.productVariant.findMany({
    where: { status: { not: "ARCHIVED" } },
    select: {
      id: true,
      stock: true,
      cost: true,
      product: {
        select: { categoryId: true, category: { select: { id: true, name: true } } },
      },
      batchItems: {
        where: { calculatedAt: { not: null } },
        select: { landedUnitCostPen: true, quantityAvailable: true },
      },
    },
  });

  let totalUnits = 0;
  let totalCents = 0;
  let fallbackLegacyValueCents = 0;
  let variantsWithBatches = 0;
  let variantsWithoutBatches = 0;
  const byCategoryMap = new Map<
    string,
    { id: string; name: string; units: number; cents: number }
  >();

  for (const v of variants) {
    const stock = v.stock;
    if (stock <= 0) continue;
    totalUnits += stock;

    const categoryId = v.product.categoryId;
    const categoryName = v.product.category?.name ?? "Sin categoría";
    const catAcc = byCategoryMap.get(categoryId) ?? {
      id: categoryId,
      name: categoryName,
      units: 0,
      cents: 0,
    };
    catAcc.units += stock;

    if (v.batchItems.length > 0) {
      variantsWithBatches += 1;
      // FIFO-like valuation: weighted average por unidades disponibles.
      const totalAvailable = v.batchItems.reduce(
        (acc, b) => acc + (b.quantityAvailable ?? 0),
        0,
      );
      let unitCostCents = 0;
      if (totalAvailable > 0) {
        const weighted = v.batchItems.reduce((acc, b) => {
          const unit = toCents(b.landedUnitCostPen, { allowNegative: true });
          return acc + unit * (b.quantityAvailable ?? 0);
        }, 0);
        unitCostCents = Math.round(weighted / totalAvailable);
      }
      const lineCents = unitCostCents * stock;
      totalCents += lineCents;
      catAcc.cents += lineCents;
    } else {
      variantsWithoutBatches += 1;
      const legacyUnitCents = v.cost
        ? toCents(v.cost, { allowNegative: true })
        : 0;
      const lineCents = legacyUnitCents * stock;
      totalCents += lineCents;
      catAcc.cents += lineCents;
      fallbackLegacyValueCents += lineCents;
    }
    byCategoryMap.set(categoryId, catAcc);
  }

  const byCategory = [...byCategoryMap.values()]
    .map((c) => ({
      categoryId: c.id,
      categoryName: c.name,
      units: c.units,
      totalCents: c.cents,
      total: centsToDecimalString(c.cents),
    }))
    .sort((a, b) => b.totalCents - a.totalCents);

  return {
    totalUnits,
    totalCents,
    total: centsToDecimalString(totalCents),
    byCategory,
    variantsWithBatches,
    variantsWithoutBatches,
    fallbackLegacyValueCents,
    fallbackLegacyValue: centsToDecimalString(fallbackLegacyValueCents),
  };
}

// =====================================================================
// Capital en lotes abiertos (no CLOSED) (RF-S24-08)
// =====================================================================

export type OpenBatchCapital = {
  totalBatches: number;
  totalInvestmentCents: Cents;
  totalInvestment: string;
  totalAvailableUnits: number;
  totalReceivedUnits: number;
  openBatchesValueCents: Cents;
  openBatchesValue: string;
  byStatus: Array<{
    status: "PURCHASED" | "IN_TRANSIT" | "COMPLETE" | "CLOSED";
    batches: number;
    investmentCents: Cents;
    investment: string;
  }>;
};

export async function getOpenBatchCapital(): Promise<OpenBatchCapital> {
  const prisma = getPrisma();
  const rows = await prisma.importBatch.findMany({
    select: {
      id: true,
      status: true,
      totalInvestmentPen: true,
      items: {
        select: {
          quantityReceived: true,
          quantityAvailable: true,
          landedUnitCostPen: true,
        },
      },
    },
  });

  const statusOrder = ["PURCHASED", "IN_TRANSIT", "COMPLETE", "CLOSED"] as const;
  const byStatusMap = new Map<
    string,
    { status: (typeof statusOrder)[number]; batches: number; cents: number }
  >();
  for (const s of statusOrder) {
    byStatusMap.set(s, { status: s, batches: 0, cents: 0 });
  }

  let totalBatches = 0;
  let totalInvestmentCents = 0;
  let totalReceivedUnits = 0;
  let totalAvailableUnits = 0;
  let openBatchesValueCents = 0;

  for (const b of rows) {
    totalBatches += 1;
    const investmentCents = toCents(b.totalInvestmentPen);
    totalInvestmentCents += investmentCents;

    let received = 0;
    let available = 0;
    let openValue = 0;
    for (const it of b.items) {
      received += it.quantityReceived ?? 0;
      available += it.quantityAvailable ?? 0;
      const unit = toCents(it.landedUnitCostPen, { allowNegative: true });
      openValue += unit * (it.quantityAvailable ?? 0);
    }
    totalReceivedUnits += received;
    totalAvailableUnits += available;
    if (b.status !== "CLOSED") {
      openBatchesValueCents += openValue;
    }

    const acc = byStatusMap.get(b.status) ?? {
      status: b.status as (typeof statusOrder)[number],
      batches: 0,
      cents: 0,
    };
    acc.batches += 1;
    acc.cents += investmentCents;
    byStatusMap.set(b.status, acc);
  }

  const byStatus = [...byStatusMap.values()].map((s) => ({
    status: s.status,
    batches: s.batches,
    investmentCents: s.cents,
    investment: centsToDecimalString(s.cents),
  }));

  return {
    totalBatches,
    totalInvestmentCents,
    totalInvestment: centsToDecimalString(totalInvestmentCents),
    totalReceivedUnits,
    totalAvailableUnits,
    openBatchesValueCents,
    openBatchesValue: centsToDecimalString(openBatchesValueCents),
    byStatus,
  };
}

// =====================================================================
// Rentabilidad por producto / variante (RF-S24-09)
// =====================================================================

export type ProductProfitabilityRow = {
  variantId: string;
  variantCode: string;
  productId: string;
  productName: string;
  categoryName: string;
  unitsSold: number;
  revenueCents: Cents;
  revenue: string;
  costCents: Cents;
  cost: string;
  grossProfitCents: Cents;
  grossProfit: string;
  marginBps: number;
};

export type ProductProfitabilityOrder = "TOP" | "BOTTOM";

export type ProductProfitabilityFilter = {
  year?: number;
  month?: number;
  salesChannel?: SalesChannel | "ALL";
  categoryId?: string | "ALL";
  limit?: number;
  order?: ProductProfitabilityOrder;
  minUnitsSold?: number;
};

export async function getProductProfitability(
  filter: ProductProfitabilityFilter = {},
): Promise<{
  rows: ProductProfitabilityRow[];
  filter: ProductProfitabilityFilter;
}> {
  const prisma = getPrisma();
  const { year, month } = {
    ...resolveCurrentPeriod(),
    ...(filter.year && filter.month ? { year: filter.year, month: filter.month } : {}),
  };
  const range = monthRange(year, month);
  const order: ProductProfitabilityOrder = filter.order ?? "TOP";
  const limit = Math.min(50, Math.max(1, filter.limit ?? 10));
  const minUnits = filter.minUnitsSold ?? 1;

  const where: Prisma.OrderItemWhereInput = {
    order: {
      status: "PAID",
      profitCalculatedAt: { gte: range.gte, lte: range.lte },
    },
    costSource: { in: ["BATCH", "LEGACY"] },
  };
  if (filter.salesChannel && filter.salesChannel !== "ALL") {
    where.order = {
      ...(where.order as Prisma.OrderWhereInput | undefined),
      salesChannel: filter.salesChannel,
    };
  }
  if (filter.categoryId && filter.categoryId !== "ALL") {
    where.variant = { product: { categoryId: filter.categoryId } };
  }

  const grouped = await prisma.orderItem.groupBy({
    by: ["variantId"],
    where,
    _sum: {
      quantity: true,
      lineTotal: true,
      totalCostPen: true,
      grossProfitPen: true,
    },
  });

  if (grouped.length === 0) {
    return { rows: [], filter };
  }

  const variantIds = grouped.map((g) => g.variantId);
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    select: {
      id: true,
      code: true,
      product: {
        select: {
          id: true,
          name: true,
          category: { select: { id: true, name: true } },
        },
      },
    },
  });
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  const rows: ProductProfitabilityRow[] = [];
  for (const g of grouped) {
    const unitsSold = g._sum.quantity ?? 0;
    if (unitsSold < minUnits) continue;
    const revenueCents = toCents(g._sum.lineTotal);
    const costCents = toCents(g._sum.totalCostPen, { allowNegative: true });
    const grossProfitCents = toCents(g._sum.grossProfitPen, { allowNegative: true });
    const marginBps =
      revenueCents > 0
        ? Math.round((grossProfitCents * 10000) / revenueCents)
        : 0;
    const v = variantMap.get(g.variantId);
    if (!v) continue;
    rows.push({
      variantId: g.variantId,
      variantCode: v.code,
      productId: v.product.id,
      productName: v.product.name,
      categoryName: v.product.category?.name ?? "Sin categoría",
      unitsSold,
      revenueCents,
      revenue: centsToDecimalString(revenueCents),
      costCents,
      cost: centsToDecimalString(costCents),
      grossProfitCents,
      grossProfit: centsToDecimalString(grossProfitCents),
      marginBps,
    });
  }

  rows.sort((a, b) =>
    order === "TOP"
      ? b.grossProfitCents - a.grossProfitCents
      : a.grossProfitCents - b.grossProfitCents,
  );

  return { rows: rows.slice(0, limit), filter };
}

// =====================================================================
// Productos sin rotacion (RF-S24-10)
// =====================================================================

export type LowRotationRow = {
  variantId: string;
  variantCode: string;
  productId: string;
  productName: string;
  categoryName: string;
  stock: number;
  reservedStock: number;
  soldStock: number;
  stockValueCents: Cents;
  stockValue: string;
  lastSoldAt: Date | null;
  daysSinceLastSale: number | null;
};

export async function getLowRotationProducts(
  days = 60,
  limit = 10,
): Promise<{ rows: LowRotationRow[]; thresholdDays: number }> {
  const prisma = getPrisma();
  const safeDays = Math.max(1, Math.min(365, Math.floor(days)));
  const safeLimit = Math.min(50, Math.max(1, Math.floor(limit)));
  const threshold = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

  const variants = await prisma.productVariant.findMany({
    where: {
      status: { not: "ARCHIVED" },
      OR: [{ stock: { gt: 0 } }, { soldStock: { gt: 0 } }],
    },
    select: {
      id: true,
      code: true,
      stock: true,
      reservedStock: true,
      soldStock: true,
      cost: true,
      product: {
        select: {
          id: true,
          name: true,
          category: { select: { id: true, name: true } },
        },
      },
      batchItems: {
        where: { calculatedAt: { not: null } },
        select: { landedUnitCostPen: true, quantityAvailable: true },
      },
    },
  });

  // AUD-PERF-005: ultima venta por variante en una sola consulta
  // (antes: findFirst por variante -> N+1).
  const variantIds = variants.map((v) => v.id);
  const lastSoldByVariant = new Map<string, Date>();
  if (variantIds.length > 0) {
    const lastSoldRows = await prisma.orderItem.groupBy({
      by: ["variantId"],
      where: {
        variantId: { in: variantIds },
        order: { status: "PAID" },
      },
      _max: { createdAt: true },
    });
    for (const row of lastSoldRows) {
      const maxDate = row._max.createdAt;
      if (maxDate) lastSoldByVariant.set(row.variantId, maxDate);
    }
  }

  const rows: LowRotationRow[] = [];
  for (const v of variants) {
    if (v.stock <= 0 && v.soldStock <= 0) continue;

    const lastSoldAt = lastSoldByVariant.get(v.id) ?? null;
    if (lastSoldAt && lastSoldAt >= threshold) continue;
    const daysSinceLastSale = lastSoldAt
      ? Math.floor((Date.now() - lastSoldAt.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    let stockValueCents = 0;
    if (v.batchItems.length > 0) {
      const totalAvailable = v.batchItems.reduce(
        (acc, b) => acc + (b.quantityAvailable ?? 0),
        0,
      );
      if (totalAvailable > 0) {
        const weighted = v.batchItems.reduce((acc, b) => {
          const unit = toCents(b.landedUnitCostPen, { allowNegative: true });
          return acc + unit * (b.quantityAvailable ?? 0);
        }, 0);
        const avgCents = Math.round(weighted / totalAvailable);
        stockValueCents = avgCents * v.stock;
      }
    } else {
      const legacy = v.cost ? toCents(v.cost, { allowNegative: true }) : 0;
      stockValueCents = legacy * v.stock;
    }

    rows.push({
      variantId: v.id,
      variantCode: v.code,
      productId: v.product.id,
      productName: v.product.name,
      categoryName: v.product.category?.name ?? "Sin categoría",
      stock: v.stock,
      reservedStock: v.reservedStock,
      soldStock: v.soldStock,
      stockValueCents,
      stockValue: centsToDecimalString(stockValueCents),
      lastSoldAt,
      daysSinceLastSale,
    });
  }

  rows.sort((a, b) => {
    // Mayor stock sin rotacion primero.
    if (b.stock !== a.stock) return b.stock - a.stock;
    const aDays = a.daysSinceLastSale ?? Number.MAX_SAFE_INTEGER;
    const bDays = b.daysSinceLastSale ?? Number.MAX_SAFE_INTEGER;
    return bDays - aDays;
  });

  return {
    rows: rows.slice(0, safeLimit),
    thresholdDays: safeDays,
  };
}

// =====================================================================
// Rentabilidad por lote
// =====================================================================

export type BatchProfitabilityRow = {
  batchId: string;
  batchCode: string;
  status: "PURCHASED" | "IN_TRANSIT" | "COMPLETE" | "CLOSED";
  purchaseDate: Date;
  investmentCents: Cents;
  investment: string;
  soldUnits: number;
  allocatedRevenueCents: Cents;
  allocatedRevenue: string;
  allocatedCostCents: Cents;
  allocatedCost: string;
  grossProfitCents: Cents;
  grossProfit: string;
  marginBps: number;
  availableUnits: number;
  roiBps: number;
};

export async function getBatchProfitability(
  filter: { year?: number; month?: number; limit?: number } = {},
): Promise<{ rows: BatchProfitabilityRow[]; filter: { year?: number; month?: number; limit?: number } }> {
  const prisma = getPrisma();
  const { year, month } = {
    ...resolveCurrentPeriod(),
    ...(filter.year && filter.month ? { year: filter.year, month: filter.month } : {}),
  };
  const limit = Math.min(50, Math.max(1, filter.limit ?? 10));
  const range = monthRange(year, month);

  // AUD-PERF-003: en vez de cargar el grafo completo (todos los lotes y
  // todas las allocations historicas) y filtrar en JS, consultamos primero
  // solo las allocations que ya cumplieron el filtro de periodo y status.
  // Luego cargamos unicamente los lotes que aparecen.
  const allocationRows = await prisma.orderItemBatchAllocation.findMany({
    where: {
      orderItem: {
        order: {
          status: "PAID",
          profitCalculatedAt: { gte: range.gte, lte: range.lte },
        },
      },
    },
    select: {
      batchId: true,
      quantity: true,
      subtotalCostPen: true,
      orderItem: { select: { lineTotal: true } },
    },
  });

  const batchTotals = new Map<
    string,
    { soldUnits: number; allocatedCostCents: number; allocatedRevenueCents: number }
  >();
  for (const a of allocationRows) {
    const acc = batchTotals.get(a.batchId) ?? {
      soldUnits: 0,
      allocatedCostCents: 0,
      allocatedRevenueCents: 0,
    };
    acc.soldUnits += a.quantity;
    acc.allocatedCostCents += toCents(a.subtotalCostPen, { allowNegative: true });
    acc.allocatedRevenueCents += toCents(a.orderItem.lineTotal);
    batchTotals.set(a.batchId, acc);
  }

  if (batchTotals.size === 0) {
    return { rows: [], filter };
  }

  const batchIds = [...batchTotals.keys()];
  const batches = await prisma.importBatch.findMany({
    where: { id: { in: batchIds }, status: { in: ["COMPLETE", "CLOSED"] } },
    select: {
      id: true,
      code: true,
      status: true,
      purchaseDate: true,
      totalInvestmentPen: true,
      items: { select: { quantityAvailable: true } },
    },
  });
  const batchMap = new Map(batches.map((b) => [b.id, b]));

  const rows: BatchProfitabilityRow[] = [];
  for (const [batchId, totals] of batchTotals) {
    const b = batchMap.get(batchId);
    if (!b) continue;

    const investmentCents = toCents(b.totalInvestmentPen);
    const grossProfitCents = totals.allocatedRevenueCents - totals.allocatedCostCents;
    const marginBps =
      totals.allocatedRevenueCents > 0
        ? Math.round((grossProfitCents * 10000) / totals.allocatedRevenueCents)
        : 0;
    const roiBps =
      investmentCents > 0
        ? Math.round((grossProfitCents * 10000) / investmentCents)
        : 0;

    const availableUnits = b.items.reduce(
      (acc, it) => acc + (it.quantityAvailable ?? 0),
      0,
    );

    if (totals.soldUnits === 0 && totals.allocatedRevenueCents === 0) {
      continue;
    }

    rows.push({
      batchId: b.id,
      batchCode: b.code,
      status: b.status,
      purchaseDate: b.purchaseDate,
      investmentCents,
      investment: centsToDecimalString(investmentCents),
      soldUnits: totals.soldUnits,
      allocatedRevenueCents: totals.allocatedRevenueCents,
      allocatedRevenue: centsToDecimalString(totals.allocatedRevenueCents),
      allocatedCostCents: totals.allocatedCostCents,
      allocatedCost: centsToDecimalString(totals.allocatedCostCents),
      grossProfitCents,
      grossProfit: centsToDecimalString(grossProfitCents),
      marginBps,
      availableUnits,
      roiBps,
    });
  }

  rows.sort((a, b) => b.grossProfitCents - a.grossProfitCents);
  return { rows: rows.slice(0, limit), filter };
}

// =====================================================================
// Alertas financieras (RF-S24-x, badges/UX)
// =====================================================================

export type FinancialAlert = {
  level: "warning" | "destructive" | "info";
  title: string;
  description: string;
  href?: string;
};

export type FinancialAlerts = {
  alerts: FinancialAlert[];
  lowMarginCount: number;
  lowRotationCount: number;
  negativeProfit: boolean;
  targetMarginBps: number;
  minimumMarginBps: number;
};

// AUD-PERF-001: la pagina ya calcula el overview y la baja rotacion.
// Aceptarlos como `precomputed` evita recalcularlos aqui.
export type FinancialAlertsPrecomputed = {
  overview?: FinancialOverview;
  lowRotationCount?: number;
  lowRotationThresholdDays?: number;
};

export async function getFinancialAlerts(
  filter: FinancialDashboardFilter = {},
  precomputed: FinancialAlertsPrecomputed = {},
): Promise<FinancialAlerts> {
  const prisma = getPrisma();
  // Leemos settings directamente de Prisma (sin unstable_cache) para que
  // esta funcion sea testeable fuera del contexto Next.js. El resto del
  // dashboard (paginas server) sigue usando `getSettings()` cacheado.
  const settings = await prisma.businessSettings.findUnique({
    where: { id: "default" },
    select: {
      minimumTargetMarginBps: true,
      objectiveTargetMarginBps: true,
    },
  });
  const minimumMarginBps = settings?.minimumTargetMarginBps ?? 1500;
  const targetMarginBps = settings?.objectiveTargetMarginBps ?? 3000;

  const overview = precomputed.overview ?? (await getFinancialOverview(filter));
  const lowRotation =
    precomputed.lowRotationCount !== undefined
      ? {
          rows: new Array(precomputed.lowRotationCount).fill(null),
          thresholdDays: precomputed.lowRotationThresholdDays ?? 60,
        }
      : await getLowRotationProducts(60, 1000);

  const lowMarginRange = monthRange(
    filter.year ?? overview.year,
    filter.month ?? overview.month,
  );
  const lowMarginWhere: Prisma.OrderItemWhereInput = {
    order: {
      status: "PAID",
      profitCalculatedAt: { gte: lowMarginRange.gte, lte: lowMarginRange.lte },
    },
    costSource: { in: ["BATCH", "LEGACY"] },
  };
  // margin bps = (grossProfit / lineTotal) * 10000
  // Filtrar en codigo via groupBy.
  const lowMarginCandidates = await prisma.orderItem.groupBy({
    by: ["variantId"],
    where: lowMarginWhere,
    _sum: { lineTotal: true, grossProfitPen: true },
  });
  let lowMarginCount = 0;
  for (const g of lowMarginCandidates) {
    const revenue = toCents(g._sum.lineTotal);
    if (revenue <= 0) continue;
    const profit = toCents(g._sum.grossProfitPen, { allowNegative: true });
    const bps = Math.round((profit * 10000) / revenue);
    if (bps < minimumMarginBps) lowMarginCount += 1;
  }

  const alerts: FinancialAlert[] = [];
  if (overview.marginBps < minimumMarginBps) {
    alerts.push({
      level: overview.marginBps < 0 ? "destructive" : "warning",
      title: "Margen por debajo del objetivo",
      description: `El margen real del mes es ${(overview.marginBps / 100).toFixed(1)}% (objetivo: ${(targetMarginBps / 100).toFixed(0)}%).`,
      href: "/reportes?section=summary",
    });
  }
  if (overview.realNetProfitCents < 0) {
    alerts.push({
      level: "destructive",
      title: "Utilidad neta real negativa",
      description: `Este mes se esta perdiendo S/ ${Math.abs(Number(overview.realNetProfit)).toFixed(2)} despues de gastos y perdidas.`,
      href: "/gastos",
    });
  }
  if (lowMarginCount > 0) {
    alerts.push({
      level: "warning",
      title: `${lowMarginCount} producto(s) con margen bajo`,
      description: `Hay variantes con margen bruto por debajo del ${(minimumMarginBps / 100).toFixed(0)}% en el mes.`,
      href: "/reportes?section=top",
    });
  }
  if (lowRotation.rows.length > 0) {
    alerts.push({
      level: "info",
      title: `${lowRotation.rows.length} producto(s) sin rotacion`,
      description: `Variantes con stock sin ventas en los ultimos ${lowRotation.thresholdDays} dias.`,
      href: "/inventario",
    });
  }

  return {
    alerts,
    lowMarginCount,
    lowRotationCount: lowRotation.rows.length,
    negativeProfit: overview.realNetProfitCents < 0,
    targetMarginBps,
    minimumMarginBps,
  };
}

// =====================================================================
// Listados de opciones para filtros
// =====================================================================

export type FilterOption = { value: string; label: string };

export async function listBatchOptions(): Promise<FilterOption[]> {
  const prisma = getPrisma();
  const rows = await prisma.importBatch.findMany({
    where: { status: { in: ["PURCHASED", "IN_TRANSIT", "COMPLETE", "CLOSED"] } },
    select: { id: true, code: true, status: true, purchaseDate: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return [
    { value: "ALL", label: "Todos los lotes" },
    ...rows.map((r) => ({
      value: r.id,
      label: `${r.code} · ${r.status} · ${r.purchaseDate.toISOString().slice(0, 10)}`,
    })),
  ];
}

export async function listCategoryOptionsForFilter(): Promise<FilterOption[]> {
  const prisma = getPrisma();
  const rows = await prisma.category.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return [{ value: "ALL", label: "Todas las categorías" }, ...rows.map((r) => ({ value: r.id, label: r.name }))];
}

export const SALES_CHANNEL_FILTER_OPTIONS: FilterOption[] = [
  { value: "ALL", label: "Todos los canales" },
  ...Object.values(SalesChannel).map((c) => ({ value: c, label: c })),
];

export function safeSalesChannel(value: unknown): SalesChannel | "ALL" {
  if (typeof value !== "string") return "ALL";
  if (value === "ALL") return "ALL";
  if ((Object.values(SalesChannel) as string[]).includes(value)) {
    return value as SalesChannel;
  }
  return "ALL";
}

export function safeAllString(value: unknown, fallback = "ALL"): string {
  if (typeof value !== "string") return fallback;
  if (value === "") return fallback;
  return value;
}

export function safeYearMonth(yearRaw: unknown, monthRaw: unknown): { year: number; month: number } {
  const current = resolveCurrentPeriod();
  const yearNum = Number(yearRaw);
  const monthNum = Number(monthRaw);
  const year =
    Number.isInteger(yearNum) && yearNum >= 2000 && yearNum <= 2100
      ? yearNum
      : current.year;
  const month =
    Number.isInteger(monthNum) && monthNum >= 1 && monthNum <= 12
      ? monthNum
      : current.month;
  return { year, month };
}
