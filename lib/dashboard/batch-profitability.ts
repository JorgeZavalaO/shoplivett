import { centsToDecimalString, toCents, type Cents } from "@/lib/money";
import { getPrisma } from "@/lib/prisma";
import { monthRange } from "@/lib/dashboard/overview";

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
): Promise<{
  rows: BatchProfitabilityRow[];
  filter: { year?: number; month?: number; limit?: number };
}> {
  const prisma = getPrisma();
  const current = new Date();
  const { year, month } = filter.year && filter.month
    ? { year: filter.year, month: filter.month }
    : { year: current.getFullYear(), month: current.getMonth() + 1 };
  const limit = Math.min(50, Math.max(1, filter.limit ?? 10));
  const range = monthRange(year, month);

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
    {
      soldUnits: number;
      allocatedCostCents: number;
      allocatedRevenueCents: number;
    }
  >();
  for (const a of allocationRows) {
    const acc = batchTotals.get(a.batchId) ?? {
      soldUnits: 0,
      allocatedCostCents: 0,
      allocatedRevenueCents: 0,
    };
    acc.soldUnits += a.quantity;
    acc.allocatedCostCents += toCents(a.subtotalCostPen, {
      allowNegative: true,
    });
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
    const grossProfitCents =
      totals.allocatedRevenueCents - totals.allocatedCostCents;
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
