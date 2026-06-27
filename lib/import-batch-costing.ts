import { centsToDecimalString, toCents, type Cents } from "@/lib/money";

export class CostingError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "ZERO_TOTAL_VALUE"
      | "ZERO_TOTAL_WEIGHT"
      | "ZERO_TOTAL_QUANTITY"
      | "INVALID_MIX_PERCENTS"
      | "INVALID_RATE"
      | "INVALID_INPUT",
  ) {
    super(message);
    this.name = "CostingError";
  }
}

export type CostInput = {
  id: string;
  unitCostPen: number;
  subtotalPen: number;
  quantityPurchased: number;
  weight: number;
};

export type CostedItem = {
  id: string;
  unitCostPen: number;
  quantityPurchased: number;
  weight: number;
  subtotalPen: number;
  additionalSubtotalPen: number;
  additionalUnitCostPen: number;
  landedUnitCostPen: number;
  landedSubtotalPen: number;
};

export type CostBreakdownEntry = {
  itemId: string;
  method: "BY_VALUE" | "BY_WEIGHT" | "MIXED" | "MANUAL";
  sharePercent: number;
  additionalSubtotalPen: number;
  additionalUnitCostPen: number;
  landedUnitCostPen: number;
  landedSubtotalPen: number;
};

export type CostBreakdown = {
  method: "BY_VALUE" | "BY_WEIGHT" | "MIXED" | "MANUAL";
  totalAdditionalPen: number;
  totalLandedPen: number;
  entries: CostBreakdownEntry[];
};

export type DistributionInput = {
  method: "BY_VALUE" | "BY_WEIGHT" | "MIXED" | "MANUAL";
  valuePercent?: number;
  weightPercent?: number;
};

export type RecalculateInput = {
  method: DistributionInput["method"];
  valuePercent?: number;
  weightPercent?: number;
  totalAdditionalCostsUsd: number | string;
  totalAdditionalCostsPen: number | string;
  exchangeRate: number | string;
};

export type RecalculateResult = {
  items: CostedItem[];
  breakdown: CostBreakdown;
  totalLandedPen: number;
};

export type PricingMargins = {
  minimumTargetMarginBps: number;
  objectiveTargetMarginBps: number;
};

export type ItemPricing = {
  landedUnitCostPen: number;
  minimumPrice: number;
  suggestedPrice: number;
  currentMarginPercent: number;
};

function centsToPen(cents: Cents): number {
  return Number(centsToDecimalString(cents));
}

function roundPen4(value: number): number {
  return Number(value.toFixed(4));
}

function divideCentsByQtyToPen4(cents: Cents, qty: number): number {
  if (qty <= 0) return 0;
  return roundPen4(centsToPen(cents) / qty);
}

export function convertUsdToPenCents(
  amountUsd: number | string,
  rate: number | string,
): Cents {
  const nUsd = typeof amountUsd === "string" ? Number(amountUsd) : amountUsd;
  const nRate = typeof rate === "string" ? Number(rate) : rate;
  if (!Number.isFinite(nUsd) || nUsd < 0) {
    throw new CostingError(`Monto USD invalido: ${amountUsd}`, "INVALID_INPUT");
  }
  if (!Number.isFinite(nRate) || nRate <= 0) {
    throw new CostingError(`Tipo de cambio invalido: ${rate}`, "INVALID_RATE");
  }
  return toCents(nUsd * nRate);
}

export function convertUsdToPen(
  amountUsd: number | string,
  rate: number | string,
): number {
  return centsToPen(convertUsdToPenCents(amountUsd, rate));
}

export function calculateTotalInvestmentPenCents(
  totalCostPen: number | string,
  totalAdditionalCostsUsd: number | string,
  totalAdditionalCostsPen: number | string,
  rate: number | string,
): Cents {
  return (
    toCents(totalCostPen) +
    convertUsdToPenCents(totalAdditionalCostsUsd ?? 0, rate) +
    toCents(totalAdditionalCostsPen ?? 0)
  );
}

export function calculateTotalInvestmentPen(
  totalCostPen: number | string,
  totalAdditionalCostsUsd: number | string,
  totalAdditionalCostsPen: number | string,
  rate: number | string,
): number {
  return centsToPen(
    calculateTotalInvestmentPenCents(
      totalCostPen,
      totalAdditionalCostsUsd,
      totalAdditionalCostsPen,
      rate,
    ),
  );
}

export function calculateDistributableAdditionalCents(
  totalAdditionalCostsUsd: number | string,
  totalAdditionalCostsPen: number | string,
  rate: number | string,
): Cents {
  return (
    convertUsdToPenCents(totalAdditionalCostsUsd ?? 0, rate) +
    toCents(totalAdditionalCostsPen ?? 0)
  );
}

export function calculateDistributableAdditionalPen(
  totalAdditionalCostsUsd: number | string,
  totalAdditionalCostsPen: number | string,
  rate: number | string,
): number {
  return centsToPen(
    calculateDistributableAdditionalCents(
      totalAdditionalCostsUsd,
      totalAdditionalCostsPen,
      rate,
    ),
  );
}

function zeroDistribution(items: CostInput[]): Map<string, Cents> {
  return new Map(items.map((item) => [item.id, 0]));
}

function allocateByWeights(
  items: Array<{ id: string; weight: number }>,
  totalCents: Cents,
  errorCode: "ZERO_TOTAL_VALUE" | "ZERO_TOTAL_WEIGHT",
): Map<string, Cents> {
  if (totalCents <= 0) return new Map(items.map((item) => [item.id, 0]));

  const positiveItems = items.filter((item) => item.weight > 0);
  const totalWeight = positiveItems.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) {
    throw new CostingError(
      errorCode === "ZERO_TOTAL_VALUE"
        ? "No se puede distribuir por valor: el valor total de los items es 0."
        : "No se puede distribuir por peso: el peso total de los items es 0.",
      errorCode,
    );
  }

  const draft = positiveItems.map((item) => {
    const raw = (item.weight * totalCents) / totalWeight;
    const floor = Math.floor(raw);
    return {
      id: item.id,
      floor,
      remainder: raw - floor,
    };
  });

  const allocated = draft.reduce((sum, item) => sum + item.floor, 0);
  let leftover = totalCents - allocated;

  draft.sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder - a.remainder;
    return a.id.localeCompare(b.id);
  });

  let cursor = 0;
  while (leftover > 0 && draft.length > 0) {
    draft[cursor].floor += 1;
    leftover -= 1;
    cursor = (cursor + 1) % draft.length;
  }

  const result = new Map<string, Cents>(items.map((item) => [item.id, 0]));
  for (const item of draft) {
    result.set(item.id, item.floor);
  }
  return result;
}

export function distributeByValue(
  items: CostInput[],
  totalAdditionalCents: Cents,
): Map<string, Cents> {
  if (totalAdditionalCents <= 0) return zeroDistribution(items);
  return allocateByWeights(
    items.map((item) => ({
      id: item.id,
      weight: item.quantityPurchased > 0 ? toCents(item.subtotalPen) : 0,
    })),
    totalAdditionalCents,
    "ZERO_TOTAL_VALUE",
  );
}

export function distributeByWeight(
  items: CostInput[],
  totalAdditionalCents: Cents,
): Map<string, Cents> {
  if (totalAdditionalCents <= 0) return zeroDistribution(items);
  return allocateByWeights(
    items.map((item) => ({
      id: item.id,
      weight: item.quantityPurchased > 0 ? item.weight * item.quantityPurchased : 0,
    })),
    totalAdditionalCents,
    "ZERO_TOTAL_WEIGHT",
  );
}

export function distributeMixed(
  items: CostInput[],
  totalAdditionalCents: Cents,
  valuePercent: number,
  weightPercent: number,
): Map<string, Cents> {
  if (
    !Number.isInteger(valuePercent) ||
    !Number.isInteger(weightPercent) ||
    valuePercent < 0 ||
    weightPercent < 0 ||
    valuePercent + weightPercent !== 100
  ) {
    throw new CostingError(
      `Porcentajes invalidos para reparto mixto: valor=${valuePercent}, peso=${weightPercent}. Deben sumar 100.`,
      "INVALID_MIX_PERCENTS",
    );
  }

  if (totalAdditionalCents <= 0) return zeroDistribution(items);

  const valuePool = Math.floor((totalAdditionalCents * valuePercent) / 100);
  const weightPool = totalAdditionalCents - valuePool;
  const byValue = distributeByValue(items, valuePool);
  const byWeight = distributeByWeight(items, weightPool);

  const result = new Map<string, Cents>();
  for (const item of items) {
    result.set(item.id, (byValue.get(item.id) ?? 0) + (byWeight.get(item.id) ?? 0));
  }
  return result;
}

export function distributeManual(items: CostInput[]): Map<string, Cents> {
  return zeroDistribution(items);
}

export function calculateLandedCosts(
  items: CostInput[],
  input: RecalculateInput,
): RecalculateResult {
  const totalAdditionalCents = calculateDistributableAdditionalCents(
    input.totalAdditionalCostsUsd,
    input.totalAdditionalCostsPen,
    input.exchangeRate,
  );

  let distribution: Map<string, Cents>;
  switch (input.method) {
    case "BY_VALUE":
      distribution = distributeByValue(items, totalAdditionalCents);
      break;
    case "BY_WEIGHT":
      distribution = distributeByWeight(items, totalAdditionalCents);
      break;
    case "MIXED":
      distribution = distributeMixed(
        items,
        totalAdditionalCents,
        input.valuePercent ?? 50,
        input.weightPercent ?? 50,
      );
      break;
    case "MANUAL":
      distribution = distributeManual(items);
      break;
  }

  const totalBaseCents = items.reduce<number>(
    (sum, item) => sum + (item.quantityPurchased > 0 ? toCents(item.subtotalPen) : 0),
    0,
  );

  const costedItems: CostedItem[] = [];
  const breakdownEntries: CostBreakdownEntry[] = [];
  let totalLandedCents = 0;

  for (const item of items) {
    const baseSubtotalCents = toCents(item.subtotalPen);
    const additionalSubtotalCents = distribution.get(item.id) ?? 0;
    const landedSubtotalCents = baseSubtotalCents + additionalSubtotalCents;
    totalLandedCents += landedSubtotalCents;

    const sharePercent =
      totalBaseCents > 0 && baseSubtotalCents > 0
        ? Number(((baseSubtotalCents / totalBaseCents) * 100).toFixed(2))
        : 0;

    const additionalUnitCostPen = divideCentsByQtyToPen4(
      additionalSubtotalCents,
      item.quantityPurchased,
    );
    const landedUnitCostPen = divideCentsByQtyToPen4(
      landedSubtotalCents,
      item.quantityPurchased,
    );

    const costedItem: CostedItem = {
      id: item.id,
      unitCostPen: item.unitCostPen,
      quantityPurchased: item.quantityPurchased,
      weight: item.weight,
      subtotalPen: item.subtotalPen,
      additionalSubtotalPen: centsToPen(additionalSubtotalCents),
      additionalUnitCostPen,
      landedUnitCostPen,
      landedSubtotalPen: centsToPen(landedSubtotalCents),
    };

    costedItems.push(costedItem);
    breakdownEntries.push({
      itemId: item.id,
      method: input.method,
      sharePercent,
      additionalSubtotalPen: centsToPen(additionalSubtotalCents),
      additionalUnitCostPen,
      landedUnitCostPen,
      landedSubtotalPen: centsToPen(landedSubtotalCents),
    });
  }

  return {
    items: costedItems,
    breakdown: {
      method: input.method,
      totalAdditionalPen: centsToPen(totalAdditionalCents),
      totalLandedPen: centsToPen(totalLandedCents),
      entries: breakdownEntries,
    },
    totalLandedPen: centsToPen(totalLandedCents),
  };
}

export function getItemPricing(
  landedUnitCostPen: number,
  currentSellingPrice: number | null,
  margins: PricingMargins,
): ItemPricing {
  const minBps = Math.max(0, Math.min(10000, margins.minimumTargetMarginBps));
  const objBps = Math.max(0, Math.min(10000, margins.objectiveTargetMarginBps));

  const minimumPrice =
    minBps >= 10000 ? landedUnitCostPen : landedUnitCostPen / (1 - minBps / 10000);
  const suggestedPrice =
    objBps >= 10000 ? landedUnitCostPen : landedUnitCostPen / (1 - objBps / 10000);

  let currentMarginPercent = 0;
  if (currentSellingPrice !== null && currentSellingPrice > 0) {
    currentMarginPercent =
      ((currentSellingPrice - landedUnitCostPen) / currentSellingPrice) * 100;
  }

  return {
    landedUnitCostPen,
    minimumPrice,
    suggestedPrice,
    currentMarginPercent,
  };
}

export function formatPen(value: number, decimals = 2): string {
  return `S/ ${value.toFixed(decimals)}`;
}

export function formatBpsAsPercent(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}
