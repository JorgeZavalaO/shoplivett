import { Prisma } from "@prisma/client";

import { centsToDecimalString, type Cents } from "@/lib/money";
import { getPrisma } from "@/lib/prisma";
import {
  resolveCents,
  safeRange,
  type ReportDateRange,
} from "@/lib/reports/shared/core";

export type SalesByMonthRow = {
  year: number;
  month: number;
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
  deliveryBusinessCostCents: Cents;
  deliveryBusinessCost: string;
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
    deliveryBusinessCostCents: Cents;
    deliveryBusinessCost: string;
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

function expandMonthRange(
  range: ReportDateRange,
): Array<{ year: number; month: number }> {
  const start = range.from ?? new Date(new Date().getFullYear(), 0, 1);
  const end = range.to ?? new Date();
  const startYear = start.getFullYear();
  const startMonth = start.getMonth() + 1;
  const endYear = end.getFullYear();
  const endMonth = end.getMonth() + 1;
  const months: Array<{ year: number; month: number }> = [];
  let y = startYear;
  let m = startMonth;
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
    ...(Object.keys(whereRange).length > 0
      ? { profitCalculatedAt: whereRange }
      : {}),
  };

  type AggRow = {
    bucket: Date;
    count: bigint | number;
    total: { toString(): string } | null;
    productCost: { toString(): string } | null;
    grossProfit: { toString(): string } | null;
    paymentFee: { toString(): string } | null;
    packagingCost: { toString(): string } | null;
    deliveryBusinessCost: { toString(): string } | null;
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
        ,SUM("deliveryBusinessCostPen") AS deliveryBusinessCost
      FROM "Order"
      WHERE "status" = 'PAID'
        ${whereRange.gte ? Prisma.sql`AND "profitCalculatedAt" >= ${whereRange.gte}` : Prisma.empty}
        ${whereRange.lte ? Prisma.sql`AND "profitCalculatedAt" <= ${whereRange.lte}` : Prisma.empty}
      GROUP BY 1
      ORDER BY 1 ASC
    `;
    aggRows = raw;
  } catch (err) {
    console.error("[getSalesByMonthReport] raw query failed, returning empty", err);
    aggRows = [];
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
  let totalDeliveryBusinessCost = 0;
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
    const deliveryBusinessCost = resolveCents(
      row?.deliveryBusinessCost,
      true,
    );
    const netProfit = grossProfit - paymentFee - packagingCost - deliveryBusinessCost;
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
      deliveryBusinessCostCents: deliveryBusinessCost,
      deliveryBusinessCost: centsToDecimalString(deliveryBusinessCost),
      netProfitCents: netProfit,
      netProfit: centsToDecimalString(netProfit),
      marginBps,
    });
    totalRevenue += revenue;
    totalProductCost += productCost;
    totalGrossProfit += grossProfit;
    totalDeliveryBusinessCost += deliveryBusinessCost;
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
      deliveryBusinessCostCents: totalDeliveryBusinessCost,
      deliveryBusinessCost: centsToDecimalString(totalDeliveryBusinessCost),
      netProfitCents: totalNetProfit,
      netProfit: centsToDecimalString(totalNetProfit),
      ordersCount: totalOrders,
    },
    range,
  };
}
