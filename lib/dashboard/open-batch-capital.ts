import { centsToDecimalString, toCents, type Cents } from "@/lib/money";
import { getPrisma } from "@/lib/prisma";

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
