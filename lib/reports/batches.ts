import { centsToDecimalString, type Cents } from "@/lib/money";
import { getPrisma } from "@/lib/prisma";
import {
  buildReportLimitMeta,
  resolveCents,
  safeRange,
  trimReportRows,
  type ReportDateRange,
  type ReportLimitMeta,
} from "@/lib/reports/shared/core";

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
  meta: ReportLimitMeta;
};

export async function getBatchProfitabilityReport(
  range: ReportDateRange,
): Promise<BatchProfitabilityReport> {
  const prisma = getPrisma();
  const whereRange = safeRange(range);

  const allocationRows = await prisma.orderItemBatchAllocation.findMany({
    where: {
      orderItem: {
        order: {
          status: "PAID",
          ...(Object.keys(whereRange).length > 0
            ? { profitCalculatedAt: whereRange }
            : {}),
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
    { soldUnits: number; allocatedCost: number; allocatedRevenue: number }
  >();
  for (const a of allocationRows) {
    const acc = batchTotals.get(a.batchId) ?? {
      soldUnits: 0,
      allocatedCost: 0,
      allocatedRevenue: 0,
    };
    acc.soldUnits += a.quantity;
    acc.allocatedCost += resolveCents(a.subtotalCostPen, true);
    acc.allocatedRevenue += resolveCents(a.orderItem.lineTotal);
    batchTotals.set(a.batchId, acc);
  }

  const rows: BatchProfitabilityRow[] = [];
  let totalInvestment = 0;
  let totalSoldUnits = 0;
  let totalAllocatedRevenue = 0;
  let totalGrossProfit = 0;

  if (batchTotals.size > 0) {
    const batchIds = [...batchTotals.keys()];
    const batches = await prisma.importBatch.findMany({
      where: { id: { in: batchIds } },
      select: {
        id: true,
        code: true,
        status: true,
        purchaseDate: true,
        shopper: true,
        agency: true,
        totalInvestmentPen: true,
        items: { select: { quantityAvailable: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    for (const b of batches) {
      const totals = batchTotals.get(b.id);
      if (!totals) continue;
      const { soldUnits, allocatedCost, allocatedRevenue } = totals;
      const investment = resolveCents(b.totalInvestmentPen);
      const grossProfit = allocatedRevenue - allocatedCost;
      const marginBps =
        allocatedRevenue > 0
          ? Math.round((grossProfit * 10000) / allocatedRevenue)
          : 0;
      const roiBps =
        investment > 0 ? Math.round((grossProfit * 10000) / investment) : 0;
      const availableUnits = b.items.reduce(
        (acc, it) => acc + (it.quantityAvailable ?? 0),
        0,
      );

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
  }

  rows.sort((a, b) => b.grossProfitCents - a.grossProfitCents);
  const totalRows = rows.length;
  const { rows: limitedRows, truncated } = trimReportRows(rows);

  return {
    rows: limitedRows,
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
    meta: buildReportLimitMeta(limitedRows.length, truncated, totalRows),
  };
}
