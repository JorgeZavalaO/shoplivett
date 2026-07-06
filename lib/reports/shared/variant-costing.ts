import { toCents, type Cents } from "@/lib/money";

type BatchCostRow = {
  landedUnitCostPen: { toString(): string } | string | null;
  quantityAvailable: number | null;
};

export function weightedUnitCostFromBatches(batchItems: BatchCostRow[]): Cents {
  const totalAvailable = batchItems.reduce(
    (acc, batch) => acc + (batch.quantityAvailable ?? 0),
    0,
  );
  if (totalAvailable <= 0) return 0;

  const weighted = batchItems.reduce((acc, batch) => {
    const unit = toCents(batch.landedUnitCostPen, { allowNegative: true });
    return acc + unit * (batch.quantityAvailable ?? 0);
  }, 0);

  return Math.round(weighted / totalAvailable);
}

export function legacyUnitCostCents(
  cost: { toString(): string } | string | null | undefined,
): Cents {
  return cost ? toCents(cost, { allowNegative: true }) : 0;
}
