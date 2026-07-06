import { Prisma } from "@prisma/client";

import { centsToDecimalString, type Cents } from "@/lib/money";
import { getPrisma } from "@/lib/prisma";
import {
  MAX_REPORT_ROWS,
  buildReportLimitMeta,
  resolveCents,
  safeRange,
  trimReportRows,
  type ReportDateRange,
  type ReportLimitMeta,
} from "@/lib/reports/shared/core";

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
  meta: ReportLimitMeta;
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
      ...(Object.keys(whereRange).length > 0
        ? { profitCalculatedAt: whereRange }
        : {}),
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
    orderBy: { _sum: { grossProfitPen: "desc" } },
    take: MAX_REPORT_ROWS + 1,
  });

  const { rows: limitedGrouped, truncated } = trimReportRows(grouped);
  const variantIds = limitedGrouped.map((g) => g.variantId);
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
  for (const g of limitedGrouped) {
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
    meta: buildReportLimitMeta(rows.length, truncated),
  };
}
