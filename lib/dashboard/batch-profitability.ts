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

  // GroupBy en SQL: agregar por batchId acotado a los top batches
  // por inversión, sin traer todas las allocations del mes.
  const allocationRows = await prisma.orderItemBatchAllocation.groupBy({
    by: ["batchId"],
    where: {
      orderItem: {
        order: {
          status: "PAID",
          profitCalculatedAt: { gte: range.gte, lte: range.lte },
        },
      },
    },
    _sum: { quantity: true, subtotalCostPen: true },
    orderBy: { _sum: { subtotalCostPen: "desc" } },
    take: limit * 2,
  });

  if (allocationRows.length === 0) {
    return { rows: [], filter };
  }

  const batchIds = allocationRows.map((r) => r.batchId);
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

  // Obtener revenue (lineTotal de OrderItem) agregado por batchId.
  // Cargamos las allocations de los batches top y agregamos en
  // memoria (ya es un conjunto acotado a limit * 2).
  const detailAllocations = await prisma.orderItemBatchAllocation.findMany({
    where: { batchId: { in: batchIds } },
    select: {
      batchId: true,
      quantity: true,
      subtotalCostPen: true,
      orderItem: { select: { lineTotal: true } },
    },
  });

  const revenueByBatch = new Map<string, Cents>();
  for (const a of detailAllocations) {
    const current = revenueByBatch.get(a.batchId) ?? 0;
    revenueByBatch.set(
      a.batchId,
      current + toCents(a.orderItem.lineTotal, { allowNegative: true }),
    );
  }

  const rows: BatchProfitabilityRow[] = [];
  for (const a of allocationRows) {
    const b = batchMap.get(a.batchId);
    if (!b) continue;

    const investmentCents = toCents(b.totalInvestmentPen);
    const soldUnits = a._sum.quantity ?? 0;
    const allocatedCostCents = toCents(a._sum.subtotalCostPen, {
      allowNegative: true,
    });
    const allocatedRevenueCents = revenueByBatch.get(a.batchId) ?? 0;

    if (soldUnits === 0 && allocatedRevenueCents === 0) continue;

    const grossProfitCents = allocatedRevenueCents - allocatedCostCents;
    const marginBps =
      allocatedRevenueCents > 0
        ? Math.round((grossProfitCents * 10000) / allocatedRevenueCents)
        : 0;
    const roiBps =
      investmentCents > 0
        ? Math.round((grossProfitCents * 10000) / investmentCents)
        : 0;

    const availableUnits = b.items.reduce(
      (acc, it) => acc + (it.quantityAvailable ?? 0),
      0,
    );

    rows.push({
      batchId: b.id,
      batchCode: b.code,
      status: b.status,
      purchaseDate: b.purchaseDate,
      investmentCents,
      investment: centsToDecimalString(investmentCents),
      soldUnits,
      allocatedRevenueCents,
      allocatedRevenue: centsToDecimalString(allocatedRevenueCents),
      allocatedCostCents,
      allocatedCost: centsToDecimalString(allocatedCostCents),
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
