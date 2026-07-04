// Modulo de reportes financieros descargables (Sprint 25).
//
// Cada funcion `getXxxReport` devuelve los mismos datos que su contraparte
// en `lib/financial-dashboard.ts` o `lib/expenses.ts`/`lib/incidents.ts`,
// pero en un formato tabular pensado para vista de reporte y exportacion
// CSV. Los selectores son minimos y los totales se devuelven en centavos
// enteros (`Cents`) ademas del string decimal para evitar acoplamiento con
// la UI.
//
// Reglas:
//   - No se cachea: cada peticion recalcula. Apto para serverless.
//   - `select` especifico en todas las queries para no arrastrar PII.
//   - Los filtros de rango se aplican a `Order.profitCalculatedAt` para
//     ventas (cumpliendo la regla "utilidad cuando PAID") y a las fechas
//     nativas para gastos/incidencias.
//
// RF cubiertos:
//   - RF-S25-01: ventas por mes
//   - RF-S25-02: utilidad por producto
//   - RF-S25-03: rentabilidad por lote
//   - RF-S25-04: stock valorizado
//   - RF-S25-05: productos sin rotacion
//   - RF-S25-06: gastos operativos
//   - RF-S25-07: clientes (resumen financiero)
//   - RF-S25-08: devoluciones y perdidas
//   - RF-S25-09: exportacion CSV (usado por Route Handlers)

import { Prisma, SalesChannel } from "@prisma/client";

import { getPrisma } from "@/lib/prisma";
import { centsToDecimalString, toCents, type Cents } from "@/lib/money";
import { EXPENSE_CATEGORY_LABELS, EXPENSE_TYPE_LABELS } from "@/lib/expenses-shared";
import { INCIDENT_DECISION_LABELS, INCIDENT_TYPE_LABELS } from "@/lib/incidents-shared";
import { SALES_CHANNEL_LABELS } from "@/lib/settings-defaults";

const ZERO = "0.00";

export type ReportDateRange = { from: Date | null; to: Date | null };

function safeRange(
  range: ReportDateRange,
): { gte?: Date; lte?: Date } {
  const out: { gte?: Date; lte?: Date } = {};
  if (range.from) out.gte = range.from;
  if (range.to) out.lte = range.to;
  return out;
}

function resolveCents(
  value: string | number | { toString(): string } | null | undefined,
  allowNegative = false,
): Cents {
  return toCents(value, { allowNegative });
}

// =====================================================================
// Ventas por mes (RF-S25-01)
// =====================================================================

export type SalesByMonthRow = {
  year: number;
  month: number; // 1-12
  monthLabel: string;
  ordersCount: number;
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
  marginBps: number;
};

export type SalesByMonthReport = {
  rows: SalesByMonthRow[];
  totals: {
    revenueCents: Cents;
    revenue: string;
    productCostCents: Cents;
    productCost: string;
    grossProfitCents: Cents;
    grossProfit: string;
    netProfitCents: Cents;
    netProfit: string;
    ordersCount: number;
  };
  range: ReportDateRange;
};

const MONTH_LABELS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

function monthLabel(year: number, month: number): string {
  return `${MONTH_LABELS[month - 1] ?? "?"} ${year}`;
}

function expandMonthRange(range: ReportDateRange): Array<{ year: number; month: number }> {
  const start = range.from ?? new Date(new Date().getFullYear(), 0, 1);
  const end = range.to ?? new Date();
  const startYear = start.getFullYear();
  const startMonth = start.getMonth() + 1;
  const endYear = end.getFullYear();
  const endMonth = end.getMonth() + 1;
  const months: Array<{ year: number; month: number }> = [];
  let y = startYear;
  let m = startMonth;
  // Limite duro: 120 meses para evitar queries gigantes.
  let safety = 120;
  while (safety > 0 && (y < endYear || (y === endYear && m <= endMonth))) {
    months.push({ year: y, month: m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    safety -= 1;
  }
  return months;
}

export async function getSalesByMonthReport(
  range: ReportDateRange,
): Promise<SalesByMonthReport> {
  const prisma = getPrisma();
  const months = expandMonthRange(range);
  const whereRange = safeRange(range);
  const where: Prisma.OrderWhereInput = {
    status: "PAID",
    ...(Object.keys(whereRange).length > 0 ? { profitCalculatedAt: whereRange } : {}),
  };

  // Agregamos por mes usando date_trunc. Esto evita N queries individuales.
  type AggRow = {
    bucket: Date;
    count: bigint | number;
    total: { toString(): string } | null;
    productCost: { toString(): string } | null;
    grossProfit: { toString(): string } | null;
    paymentFee: { toString(): string } | null;
    packagingCost: { toString(): string } | null;
  };

  let aggRows: AggRow[] = [];
  try {
    const raw = await prisma.$queryRaw<AggRow[]>`
      SELECT
        date_trunc('month', "profitCalculatedAt") AS bucket,
        COUNT(*)::bigint AS count,
        SUM("total") AS total,
        SUM("productCostPen") AS productCost,
        SUM("grossProfitPen") AS grossProfit,
        SUM("paymentFeePen") AS paymentFee,
        SUM("packagingCostPen") AS packagingCost
      FROM "Order"
      WHERE "status" = 'PAID'
        ${whereRange.gte ? Prisma.sql`AND "profitCalculatedAt" >= ${whereRange.gte}` : Prisma.empty}
        ${whereRange.lte ? Prisma.sql`AND "profitCalculatedAt" <= ${whereRange.lte}` : Prisma.empty}
      GROUP BY 1
      ORDER BY 1 ASC
    `;
    aggRows = raw;
  } catch {
    // Fallback a N queries si el driver no soporta $queryRaw con este
    // tipo. En produccion Neon + Prisma lo soporta; este fallback es
    // defensivo para entornos de test.
    aggRows = [];
    for (const m of months) {
      const gte = new Date(m.year, m.month - 1, 1, 0, 0, 0, 0);
      const lte = new Date(m.year, m.month, 0, 23, 59, 59, 999);
      const [cnt, totals] = await Promise.all([
        prisma.order.count({ where: { ...where, profitCalculatedAt: { gte, lte } } }),
        prisma.order.aggregate({
          where: { ...where, profitCalculatedAt: { gte, lte } },
          _sum: {
            total: true,
            productCostPen: true,
            grossProfitPen: true,
            paymentFeePen: true,
            packagingCostPen: true,
          },
        }),
      ]);
      aggRows.push({
        bucket: gte,
        count: cnt,
        total: totals._sum.total,
        productCost: totals._sum.productCostPen,
        grossProfit: totals._sum.grossProfitPen,
        paymentFee: totals._sum.paymentFeePen,
        packagingCost: totals._sum.packagingCostPen,
      });
    }
  }

  const map = new Map<string, AggRow>();
  for (const row of aggRows) {
    const d = row.bucket;
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
    map.set(key, row);
  }

  const rows: SalesByMonthRow[] = [];
  let totalRevenue = 0;
  let totalProductCost = 0;
  let totalGrossProfit = 0;
  let totalNetProfit = 0;
  let totalOrders = 0;
  for (const m of months) {
    const key = `${m.year}-${m.month}`;
    const row = map.get(key);
    const revenue = resolveCents(row?.total);
    const productCost = resolveCents(row?.productCost, true);
    const grossProfit = resolveCents(row?.grossProfit, true);
    const paymentFee = resolveCents(row?.paymentFee, true);
    const packagingCost = resolveCents(row?.packagingCost, true);
    const netProfit = grossProfit - paymentFee - packagingCost;
    const ordersCount = Number(row?.count ?? 0);
    const marginBps = revenue > 0 ? Math.round((netProfit * 10000) / revenue) : 0;
    rows.push({
      year: m.year,
      month: m.month,
      monthLabel: monthLabel(m.year, m.month),
      ordersCount,
      revenueCents: revenue,
      revenue: centsToDecimalString(revenue),
      productCostCents: productCost,
      productCost: centsToDecimalString(productCost),
      grossProfitCents: grossProfit,
      grossProfit: centsToDecimalString(grossProfit),
      paymentFeeCents: paymentFee,
      paymentFee: centsToDecimalString(paymentFee),
      packagingCostCents: packagingCost,
      packagingCost: centsToDecimalString(packagingCost),
      netProfitCents: netProfit,
      netProfit: centsToDecimalString(netProfit),
      marginBps,
    });
    totalRevenue += revenue;
    totalProductCost += productCost;
    totalGrossProfit += grossProfit;
    totalNetProfit += netProfit;
    totalOrders += ordersCount;
  }

  return {
    rows,
    totals: {
      revenueCents: totalRevenue,
      revenue: centsToDecimalString(totalRevenue),
      productCostCents: totalProductCost,
      productCost: centsToDecimalString(totalProductCost),
      grossProfitCents: totalGrossProfit,
      grossProfit: centsToDecimalString(totalGrossProfit),
      netProfitCents: totalNetProfit,
      netProfit: centsToDecimalString(totalNetProfit),
      ordersCount: totalOrders,
    },
    range,
  };
}

// =====================================================================
// Utilidad por producto (RF-S25-02)
// =====================================================================

export type ProductProfitabilityRow = {
  variantId: string;
  variantCode: string;
  productId: string;
  productName: string;
  categoryName: string;
  color: string | null;
  unitsSold: number;
  revenueCents: Cents;
  revenue: string;
  costCents: Cents;
  cost: string;
  grossProfitCents: Cents;
  grossProfit: string;
  marginBps: number;
  stock: number;
};

export type ProductProfitabilityReport = {
  rows: ProductProfitabilityRow[];
  totals: {
    unitsSold: number;
    revenueCents: Cents;
    revenue: string;
    costCents: Cents;
    cost: string;
    grossProfitCents: Cents;
    grossProfit: string;
  };
  range: ReportDateRange;
  categoryId: string | null;
};

export async function getProductProfitabilityReport(
  range: ReportDateRange,
  options: { categoryId?: string | null; minUnits?: number } = {},
): Promise<ProductProfitabilityReport> {
  const prisma = getPrisma();
  const whereRange = safeRange(range);
  const minUnits = Math.max(0, Math.floor(options.minUnits ?? 1));
  const categoryId = options.categoryId?.trim() || null;

  const where: Prisma.OrderItemWhereInput = {
    costSource: { in: ["BATCH", "LEGACY"] },
    order: {
      status: "PAID",
      ...(Object.keys(whereRange).length > 0 ? { profitCalculatedAt: whereRange } : {}),
    },
  };
  if (categoryId) {
    where.variant = { product: { categoryId } };
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

  const variantIds = grouped.map((g) => g.variantId);
  const variants = variantIds.length
    ? await prisma.productVariant.findMany({
        where: { id: { in: variantIds } },
        select: {
          id: true,
          code: true,
          color: true,
          stock: true,
          product: {
            select: {
              id: true,
              name: true,
              category: { select: { id: true, name: true } },
            },
          },
        },
      })
    : [];
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  const rows: ProductProfitabilityRow[] = [];
  let totalUnits = 0;
  let totalRevenue = 0;
  let totalCost = 0;
  let totalProfit = 0;
  for (const g of grouped) {
    const unitsSold = g._sum.quantity ?? 0;
    if (unitsSold < minUnits) continue;
    const revenue = resolveCents(g._sum.lineTotal);
    const cost = resolveCents(g._sum.totalCostPen, true);
    const profit = resolveCents(g._sum.grossProfitPen, true);
    const marginBps = revenue > 0 ? Math.round((profit * 10000) / revenue) : 0;
    const v = variantMap.get(g.variantId);
    if (!v) continue;
    rows.push({
      variantId: g.variantId,
      variantCode: v.code,
      productId: v.product.id,
      productName: v.product.name,
      categoryName: v.product.category?.name ?? "Sin categoría",
      color: v.color,
      unitsSold,
      revenueCents: revenue,
      revenue: centsToDecimalString(revenue),
      costCents: cost,
      cost: centsToDecimalString(cost),
      grossProfitCents: profit,
      grossProfit: centsToDecimalString(profit),
      marginBps,
      stock: v.stock,
    });
    totalUnits += unitsSold;
    totalRevenue += revenue;
    totalCost += cost;
    totalProfit += profit;
  }

  rows.sort((a, b) => b.grossProfitCents - a.grossProfitCents);

  return {
    rows,
    totals: {
      unitsSold: totalUnits,
      revenueCents: totalRevenue,
      revenue: centsToDecimalString(totalRevenue),
      costCents: totalCost,
      cost: centsToDecimalString(totalCost),
      grossProfitCents: totalProfit,
      grossProfit: centsToDecimalString(totalProfit),
    },
    range,
    categoryId,
  };
}

// =====================================================================
// Rentabilidad por lote (RF-S25-03)
// =====================================================================

export type BatchProfitabilityRow = {
  batchId: string;
  batchCode: string;
  status: "PURCHASED" | "IN_TRANSIT" | "COMPLETE" | "CLOSED";
  purchaseDate: Date;
  shopper: string | null;
  agency: string | null;
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
  roiBps: number;
  availableUnits: number;
};

export type BatchProfitabilityReport = {
  rows: BatchProfitabilityRow[];
  totals: {
    investmentCents: Cents;
    investment: string;
    soldUnits: number;
    allocatedRevenueCents: Cents;
    allocatedRevenue: string;
    grossProfitCents: Cents;
    grossProfit: string;
  };
  range: ReportDateRange;
};

export async function getBatchProfitabilityReport(
  range: ReportDateRange,
): Promise<BatchProfitabilityReport> {
  const prisma = getPrisma();
  const whereRange = safeRange(range);
  const batches = await prisma.importBatch.findMany({
    select: {
      id: true,
      code: true,
      status: true,
      purchaseDate: true,
      shopper: true,
      agency: true,
      totalInvestmentPen: true,
      items: {
        select: {
          quantityAvailable: true,
          allocations: {
            select: {
              quantity: true,
              subtotalCostPen: true,
              orderItem: {
                select: {
                  lineTotal: true,
                  order: {
                    select: {
                      status: true,
                      profitCalculatedAt: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows: BatchProfitabilityRow[] = [];
  let totalInvestment = 0;
  let totalSoldUnits = 0;
  let totalAllocatedRevenue = 0;
  let totalGrossProfit = 0;

  for (const b of batches) {
    let soldUnits = 0;
    let allocatedCost = 0;
    let allocatedRevenue = 0;
    for (const it of b.items) {
      for (const a of it.allocations) {
        if (a.orderItem.order.status !== "PAID") continue;
        if (a.orderItem.order.profitCalculatedAt === null) continue;
        if (whereRange.gte && a.orderItem.order.profitCalculatedAt < whereRange.gte) {
          continue;
        }
        if (whereRange.lte && a.orderItem.order.profitCalculatedAt > whereRange.lte) {
          continue;
        }
        soldUnits += a.quantity;
        allocatedCost += resolveCents(a.subtotalCostPen, true);
        allocatedRevenue += resolveCents(a.orderItem.lineTotal);
      }
    }
    const investment = resolveCents(b.totalInvestmentPen);
    const grossProfit = allocatedRevenue - allocatedCost;
    const marginBps = allocatedRevenue > 0 ? Math.round((grossProfit * 10000) / allocatedRevenue) : 0;
    const roiBps = investment > 0 ? Math.round((grossProfit * 10000) / investment) : 0;
    const availableUnits = b.items.reduce((acc, it) => acc + (it.quantityAvailable ?? 0), 0);

    if (soldUnits === 0 && allocatedRevenue === 0) continue;

    rows.push({
      batchId: b.id,
      batchCode: b.code,
      status: b.status,
      purchaseDate: b.purchaseDate,
      shopper: b.shopper,
      agency: b.agency,
      investmentCents: investment,
      investment: centsToDecimalString(investment),
      soldUnits,
      allocatedRevenueCents: allocatedRevenue,
      allocatedRevenue: centsToDecimalString(allocatedRevenue),
      allocatedCostCents: allocatedCost,
      allocatedCost: centsToDecimalString(allocatedCost),
      grossProfitCents: grossProfit,
      grossProfit: centsToDecimalString(grossProfit),
      marginBps,
      roiBps,
      availableUnits,
    });
    totalInvestment += investment;
    totalSoldUnits += soldUnits;
    totalAllocatedRevenue += allocatedRevenue;
    totalGrossProfit += grossProfit;
  }

  rows.sort((a, b) => b.grossProfitCents - a.grossProfitCents);

  return {
    rows,
    totals: {
      investmentCents: totalInvestment,
      investment: centsToDecimalString(totalInvestment),
      soldUnits: totalSoldUnits,
      allocatedRevenueCents: totalAllocatedRevenue,
      allocatedRevenue: centsToDecimalString(totalAllocatedRevenue),
      grossProfitCents: totalGrossProfit,
      grossProfit: centsToDecimalString(totalGrossProfit),
    },
    range,
  };
}

// =====================================================================
// Stock valorizado (RF-S25-04)
// =====================================================================

export type StockValuationRow = {
  variantId: string;
  variantCode: string;
  productName: string;
  categoryName: string;
  color: string | null;
  size: string | null;
  stock: number;
  reservedStock: number;
  available: number;
  unitCostCents: Cents;
  unitCost: string;
  totalCostCents: Cents;
  totalCost: string;
  hasBatches: boolean;
};

export type StockValuationReport = {
  rows: StockValuationRow[];
  totals: {
    units: number;
    totalCents: Cents;
    total: string;
    variantsWithBatches: number;
    variantsWithoutBatches: number;
    legacyTotalCents: Cents;
    legacyTotal: string;
  };
};

export async function getStockValuationReport(
  options: { categoryId?: string | null; query?: string } = {},
): Promise<StockValuationReport> {
  const prisma = getPrisma();
  const trimmed = options.query?.trim() ?? "";
  const categoryId = options.categoryId?.trim() || null;
  const where: Prisma.ProductVariantWhereInput = {
    status: { not: "ARCHIVED" },
    ...(categoryId ? { product: { categoryId } } : {}),
    ...(trimmed
      ? {
          OR: [
            { code: { contains: trimmed, mode: "insensitive" } },
            { product: { name: { contains: trimmed, mode: "insensitive" } } },
            { color: { contains: trimmed, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const variants = await prisma.productVariant.findMany({
    where,
    select: {
      id: true,
      code: true,
      color: true,
      size: true,
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
    orderBy: [{ product: { name: "asc" } }, { code: "asc" }],
  });

  const rows: StockValuationRow[] = [];
  let totalUnits = 0;
  let totalCents = 0;
  let legacyCents = 0;
  let withBatches = 0;
  let withoutBatches = 0;

  for (const v of variants) {
    const stock = v.stock;
    const hasBatches = v.batchItems.length > 0;
    let unitCostCents = 0;
    if (hasBatches) {
      const totalAvailable = v.batchItems.reduce(
        (acc, b) => acc + (b.quantityAvailable ?? 0),
        0,
      );
      if (totalAvailable > 0) {
        const weighted = v.batchItems.reduce((acc, b) => {
          const unit = resolveCents(b.landedUnitCostPen, true);
          return acc + unit * (b.quantityAvailable ?? 0);
        }, 0);
        unitCostCents = Math.round(weighted / totalAvailable);
      }
      withBatches += 1;
    } else {
      unitCostCents = v.cost ? resolveCents(v.cost, true) : 0;
      withoutBatches += 1;
    }
    const lineCents = unitCostCents * stock;
    const reservedStock = v.reservedStock;
    const soldStock = v.soldStock;
    rows.push({
      variantId: v.id,
      variantCode: v.code,
      productName: v.product.name,
      categoryName: v.product.category?.name ?? "Sin categoría",
      color: v.color,
      size: v.size,
      stock,
      reservedStock,
      available: Math.max(0, stock - reservedStock - soldStock),
      unitCostCents,
      unitCost: centsToDecimalString(unitCostCents),
      totalCostCents: lineCents,
      totalCost: centsToDecimalString(lineCents),
      hasBatches,
    });
    totalUnits += stock;
    totalCents += lineCents;
    if (!hasBatches) legacyCents += lineCents;
  }

  return {
    rows,
    totals: {
      units: totalUnits,
      totalCents,
      total: centsToDecimalString(totalCents),
      variantsWithBatches: withBatches,
      variantsWithoutBatches: withoutBatches,
      legacyTotalCents: legacyCents,
      legacyTotal: centsToDecimalString(legacyCents),
    },
  };
}

// =====================================================================
// Productos sin rotacion (RF-S25-05)
// =====================================================================

export type LowRotationRow = {
  variantId: string;
  variantCode: string;
  productName: string;
  categoryName: string;
  color: string | null;
  stock: number;
  reservedStock: number;
  soldStock: number;
  stockValueCents: Cents;
  stockValue: string;
  lastSoldAt: Date | null;
  daysSinceLastSale: number | null;
};

export type LowRotationReport = {
  rows: LowRotationRow[];
  thresholdDays: number;
  totals: {
    units: number;
    valueCents: Cents;
    value: string;
  };
};

export async function getLowRotationReport(
  options: { days?: number; categoryId?: string | null } = {},
): Promise<LowRotationReport> {
  const prisma = getPrisma();
  const safeDays = Math.max(1, Math.min(365, Math.floor(options.days ?? 60)));
  const categoryId = options.categoryId?.trim() || null;
  const threshold = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

  const variants = await prisma.productVariant.findMany({
    where: {
      status: { not: "ARCHIVED" },
      OR: [{ stock: { gt: 0 } }, { soldStock: { gt: 0 } }],
      ...(categoryId ? { product: { categoryId } } : {}),
    },
    select: {
      id: true,
      code: true,
      color: true,
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

  const rows: LowRotationRow[] = [];
  let totalUnits = 0;
  let totalCents = 0;

  for (const v of variants) {
    const last = await prisma.orderItem.findFirst({
      where: { variantId: v.id, order: { status: "PAID" } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const lastSoldAt = last?.createdAt ?? null;
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
          const unit = resolveCents(b.landedUnitCostPen, true);
          return acc + unit * (b.quantityAvailable ?? 0);
        }, 0);
        const avgCents = Math.round(weighted / totalAvailable);
        stockValueCents = avgCents * v.stock;
      }
    } else {
      const legacy = v.cost ? resolveCents(v.cost, true) : 0;
      stockValueCents = legacy * v.stock;
    }

    rows.push({
      variantId: v.id,
      variantCode: v.code,
      productName: v.product.name,
      categoryName: v.product.category?.name ?? "Sin categoría",
      color: v.color,
      stock: v.stock,
      reservedStock: v.reservedStock,
      soldStock: v.soldStock,
      stockValueCents,
      stockValue: centsToDecimalString(stockValueCents),
      lastSoldAt,
      daysSinceLastSale,
    });
    totalUnits += v.stock;
    totalCents += stockValueCents;
  }

  rows.sort((a, b) => {
    if (b.stock !== a.stock) return b.stock - a.stock;
    const aDays = a.daysSinceLastSale ?? Number.MAX_SAFE_INTEGER;
    const bDays = b.daysSinceLastSale ?? Number.MAX_SAFE_INTEGER;
    return bDays - aDays;
  });

  return {
    rows,
    thresholdDays: safeDays,
    totals: {
      units: totalUnits,
      valueCents: totalCents,
      value: centsToDecimalString(totalCents),
    },
  };
}

// =====================================================================
// Gastos operativos (RF-S25-06) - delega en lib/expenses.ts
// =====================================================================

export type FinancialExpensesRow = {
  id: string;
  expenseDate: Date;
  category: string;
  categoryLabel: string;
  expenseType: string;
  expenseTypeLabel: string;
  description: string;
  amountCents: Cents;
  amount: string;
  paymentMethod: string | null;
  status: string;
  notes: string | null;
};

export type FinancialExpensesReport = {
  rows: FinancialExpensesRow[];
  totals: {
    activeCents: Cents;
    active: string;
    voidedCents: Cents;
    voided: string;
    count: number;
  };
  range: ReportDateRange;
  category: string | "ALL";
  type: string | "ALL";
  status: string | "ALL";
};

import {
  getFinancialPeriod as _getFinancialPeriod,
  listExpenses,
  type ExpenseListFilter,
  type ExpenseListResult,
} from "@/lib/expenses";

export async function getExpensesReport(
  filter: ExpenseListFilter,
): Promise<FinancialExpensesReport> {
  const result: ExpenseListResult = await listExpenses({
    year: filter.year,
    month: filter.month,
    category: filter.category,
    status: filter.status,
    type: filter.type,
    query: filter.query,
    page: 1,
    perPage: 1000,
  });
  const rows: FinancialExpensesRow[] = result.items.map((it) => ({
    id: it.id,
    expenseDate: it.expenseDate,
    category: it.category,
    categoryLabel: EXPENSE_CATEGORY_LABELS[it.category] ?? it.category,
    expenseType: it.expenseType,
    expenseTypeLabel: EXPENSE_TYPE_LABELS[it.expenseType] ?? it.expenseType,
    description: it.description,
    amountCents: resolveCents(it.amount),
    amount: centsToDecimalString(resolveCents(it.amount)),
    paymentMethod: it.paymentMethod,
    status: it.status,
    notes: it.notes,
  }));
  // Totales separados (activo vs anulado) para el resumen.
  let activeCents = 0;
  let voidedCents = 0;
  for (const r of rows) {
    if (r.status === "ACTIVE") activeCents += r.amountCents;
    else voidedCents += r.amountCents;
  }
  return {
    rows,
    totals: {
      activeCents,
      active: centsToDecimalString(activeCents),
      voidedCents,
      voided: centsToDecimalString(voidedCents),
      count: rows.length,
    },
    range: filter.year && filter.month
      ? { from: new Date(filter.year, filter.month - 1, 1), to: new Date(filter.year, filter.month, 0, 23, 59, 59, 999) }
      : { from: null, to: null },
    category: filter.category ?? "ALL",
    type: filter.type ?? "ALL",
    status: filter.status ?? "ALL",
  };
}

void _getFinancialPeriod;

// =====================================================================
// Clientes - resumen financiero (RF-S25-07)
// =====================================================================

export type CustomerFinancialRow = {
  customerId: string;
  customerName: string;
  whatsapp: string;
  status: string;
  ordersCount: number;
  paidOrdersCount: number;
  totalBilledCents: Cents;
  totalBilled: string;
  totalPaidCents: Cents;
  totalPaid: string;
  totalPendingCents: Cents;
  totalPending: string;
  creditAvailableCents: Cents;
  creditAvailable: string;
};

export type CustomersFinancialReport = {
  rows: CustomerFinancialRow[];
  totals: {
    customers: number;
    ordersCount: number;
    paidOrdersCount: number;
    totalBilledCents: Cents;
    totalBilled: string;
    totalPaidCents: Cents;
    totalPaid: string;
    totalPendingCents: Cents;
    totalPending: string;
    creditAvailableCents: Cents;
    creditAvailable: string;
  };
  range: ReportDateRange;
  query: string;
};

export async function getCustomersFinancialReport(
  range: ReportDateRange,
  options: { query?: string } = {},
): Promise<CustomersFinancialReport> {
  const prisma = getPrisma();
  const whereRange = safeRange(range);
  const trimmed = options.query?.trim() ?? "";
  const customerWhere: Prisma.CustomerWhereInput = {
    ...(trimmed
      ? {
          OR: [
            { name: { contains: trimmed, mode: "insensitive" } },
            { searchName: { contains: trimmed.toLowerCase(), mode: "insensitive" } },
            { whatsapp: { contains: trimmed.replace(/\D/g, "") } },
          ],
        }
      : {}),
  };

  const orderWhere: Prisma.OrderWhereInput = {
    ...(Object.keys(whereRange).length > 0 ? { createdAt: whereRange } : {}),
  };

  const customers = await prisma.customer.findMany({
    where: customerWhere,
    orderBy: { name: "asc" },
    select: { id: true, name: true, whatsapp: true, status: true },
  });

  const customerIds = customers.map((c) => c.id);
  const orderGroups = customerIds.length
    ? await prisma.order.groupBy({
        by: ["customerId", "status"],
        where: { customerId: { in: customerIds }, ...orderWhere },
        _count: { _all: true },
        _sum: { total: true, validatedPaid: true, balance: true },
      })
    : [];
  const creditGroups = customerIds.length
    ? await prisma.customerCredit.groupBy({
        by: ["customerId"],
        where: {
          customerId: { in: customerIds },
          status: { in: ["AVAILABLE", "PARTIALLY_USED"] },
        },
        _sum: { availableAmount: true },
      })
    : [];

  const orderMap = new Map<
    string,
    { ordersCount: number; paidOrdersCount: number; total: number; paid: number; pending: number }
  >();
  for (const g of orderGroups) {
    const acc = orderMap.get(g.customerId) ?? {
      ordersCount: 0,
      paidOrdersCount: 0,
      total: 0,
      paid: 0,
      pending: 0,
    };
    acc.ordersCount += g._count._all;
    acc.total += resolveCents(g._sum.total);
    acc.paid += resolveCents(g._sum.validatedPaid, true);
    acc.pending += resolveCents(g._sum.balance, true);
    if (g.status === "PAID") acc.paidOrdersCount += g._count._all;
    orderMap.set(g.customerId, acc);
  }
  const creditMap = new Map<string, number>();
  for (const g of creditGroups) {
    creditMap.set(g.customerId, resolveCents(g._sum.availableAmount, true));
  }

  const rows: CustomerFinancialRow[] = customers.map((c) => {
    const o = orderMap.get(c.id) ?? {
      ordersCount: 0,
      paidOrdersCount: 0,
      total: 0,
      paid: 0,
      pending: 0,
    };
    const credit = creditMap.get(c.id) ?? 0;
    return {
      customerId: c.id,
      customerName: c.name,
      whatsapp: c.whatsapp,
      status: c.status,
      ordersCount: o.ordersCount,
      paidOrdersCount: o.paidOrdersCount,
      totalBilledCents: o.total,
      totalBilled: centsToDecimalString(o.total),
      totalPaidCents: o.paid,
      totalPaid: centsToDecimalString(o.paid),
      totalPendingCents: o.pending,
      totalPending: centsToDecimalString(o.pending),
      creditAvailableCents: credit,
      creditAvailable: centsToDecimalString(credit),
    };
  });

  rows.sort((a, b) => b.totalBilledCents - a.totalBilledCents);

  const totals = rows.reduce(
    (acc, r) => {
      acc.customers += 1;
      acc.ordersCount += r.ordersCount;
      acc.paidOrdersCount += r.paidOrdersCount;
      acc.totalBilledCents += r.totalBilledCents;
      acc.totalPaidCents += r.totalPaidCents;
      acc.totalPendingCents += r.totalPendingCents;
      acc.creditAvailableCents += r.creditAvailableCents;
      return acc;
    },
    {
      customers: 0,
      ordersCount: 0,
      paidOrdersCount: 0,
      totalBilledCents: 0,
      totalPaidCents: 0,
      totalPendingCents: 0,
      creditAvailableCents: 0,
    },
  );

  return {
    rows,
    totals: {
      customers: totals.customers,
      ordersCount: totals.ordersCount,
      paidOrdersCount: totals.paidOrdersCount,
      totalBilledCents: totals.totalBilledCents,
      totalBilled: centsToDecimalString(totals.totalBilledCents),
      totalPaidCents: totals.totalPaidCents,
      totalPaid: centsToDecimalString(totals.totalPaidCents),
      totalPendingCents: totals.totalPendingCents,
      totalPending: centsToDecimalString(totals.totalPendingCents),
      creditAvailableCents: totals.creditAvailableCents,
      creditAvailable: centsToDecimalString(totals.creditAvailableCents),
    },
    range,
    query: trimmed,
  };
}

// =====================================================================
// Devoluciones y perdidas (RF-S25-08)
// =====================================================================

export type ReturnsLossesRow = {
  incidentId: string;
  incidentDate: Date;
  type: string;
  typeLabel: string;
  status: string;
  decision: string;
  decisionLabel: string;
  orderNumber: string | null;
  variantCode: string | null;
  productName: string | null;
  customerName: string | null;
  quantity: number;
  restockQuantity: number;
  recoveredCents: Cents;
  recovered: string;
  lostCents: Cents;
  lost: string;
  description: string;
};

export type ReturnsLossesReport = {
  rows: ReturnsLossesRow[];
  totals: {
    lostCents: Cents;
    lost: string;
    recoveredCents: Cents;
    recovered: string;
    netCents: Cents;
    net: string;
  };
  range: ReportDateRange;
  type: string | "ALL";
  status: string | "ALL";
  decision: string | "ALL";
};

export async function getReturnsLossesReport(
  range: ReportDateRange,
  options: {
    type?: string;
    status?: string;
    decision?: string;
  } = {},
): Promise<ReturnsLossesReport> {
  const prisma = getPrisma();
  const whereRange = safeRange(range);
  const where: Prisma.IncidentWhereInput = {
    ...(Object.keys(whereRange).length > 0 ? { incidentDate: whereRange } : {}),
    ...(options.type && options.type !== "ALL" ? { type: options.type as Prisma.IncidentWhereInput["type"] } : {}),
    ...(options.status && options.status !== "ALL" ? { status: options.status as Prisma.IncidentWhereInput["status"] } : {}),
    ...(options.decision && options.decision !== "ALL" ? { decision: options.decision as Prisma.IncidentWhereInput["decision"] } : {}),
  };

  const items = await prisma.incident.findMany({
    where,
    orderBy: { incidentDate: "desc" },
    select: {
      id: true,
      incidentDate: true,
      type: true,
      status: true,
      decision: true,
      quantity: true,
      restockQuantity: true,
      recoveredAmount: true,
      lostAmount: true,
      description: true,
      order: { select: { orderNumber: true } },
      variant: {
        select: {
          code: true,
          product: { select: { name: true } },
        },
      },
      customer: { select: { name: true } },
    },
  });

  const rows: ReturnsLossesRow[] = items.map((it) => {
    const recovered = resolveCents(it.recoveredAmount, true);
    const lost = resolveCents(it.lostAmount, true);
    return {
      incidentId: it.id,
      incidentDate: it.incidentDate,
      type: it.type,
      typeLabel: INCIDENT_TYPE_LABELS[it.type] ?? it.type,
      status: it.status,
      decision: it.decision,
      decisionLabel: INCIDENT_DECISION_LABELS[it.decision] ?? it.decision,
      orderNumber: it.order?.orderNumber ?? null,
      variantCode: it.variant?.code ?? null,
      productName: it.variant?.product?.name ?? null,
      customerName: it.customer?.name ?? null,
      quantity: it.quantity,
      restockQuantity: it.restockQuantity,
      recoveredCents: recovered,
      recovered: centsToDecimalString(recovered),
      lostCents: lost,
      lost: centsToDecimalString(lost),
      description: it.description,
    };
  });

  let lostCents = 0;
  let recoveredCents = 0;
  for (const r of rows) {
    if (r.status === "CANCELLED") continue;
    lostCents += r.lostCents;
    recoveredCents += r.recoveredCents;
  }

  return {
    rows,
    totals: {
      lostCents,
      lost: centsToDecimalString(lostCents),
      recoveredCents,
      recovered: centsToDecimalString(recoveredCents),
      netCents: recoveredCents - lostCents,
      net: centsToDecimalString(recoveredCents - lostCents),
    },
    range,
    type: (options.type as string) ?? "ALL",
    status: (options.status as string) ?? "ALL",
    decision: (options.decision as string) ?? "ALL",
  };
}

// =====================================================================
// Canal de venta util (para que el reporte de productos pueda etiquetar)
// =====================================================================

export function channelLabel(value: string): string {
  return SALES_CHANNEL_LABELS[value as SalesChannel] ?? value;
}

void ZERO;
