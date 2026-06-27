import {
  calculateDistributableAdditionalCents,
  calculateLandedCosts,
  calculateTotalInvestmentPen,
  convertUsdToPen,
  convertUsdToPenCents,
  CostingError,
  distributeByValue,
  distributeByWeight,
  distributeMixed,
  getItemPricing,
  type CostInput,
} from "../lib/import-batch-costing";

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean, details?: string) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
    return;
  }
  failed += 1;
  console.error(`  ✗ ${name}${details ? `: ${details}` : ""}`);
}

function assertEq(name: string, actual: unknown, expected: unknown) {
  assert(name, actual === expected, `expected=${expected} actual=${actual}`);
}

function assertNear(name: string, actual: number, expected: number, tolerance = 0.0001) {
  assert(
    name,
    Math.abs(actual - expected) <= tolerance,
    `expected=${expected} actual=${actual}`,
  );
}

function expectThrow(name: string, fn: () => unknown, code: string) {
  try {
    fn();
    assert(name, false, "expected throw");
  } catch (error) {
    assert(
      name,
      error instanceof CostingError && error.code === code,
      `expected code=${code} actual=${String(error)}`,
    );
  }
}

function section(title: string) {
  console.log(`\n[${title}]`);
}

section("Conversiones");
assertEq("100 USD a 3.75 = 37500 cents", convertUsdToPenCents(100, 3.75), 37500);
assertEq("100 USD a 3.75 = 375 PEN", convertUsdToPen(100, 3.75), 375);
assertEq(
  "Adicionales 100 USD + 50 PEN",
  calculateDistributableAdditionalCents(100, 50, 3.75),
  42500,
);
assertEq(
  "Total inversion base 200 PEN + 100 USD + 50 PEN",
  calculateTotalInvestmentPen(200, 100, 50, 3.75),
  625,
);
expectThrow("Rechaza rate 0", () => convertUsdToPenCents(10, 0), "INVALID_RATE");

const valueItems: CostInput[] = [
  {
    id: "a",
    unitCostPen: 10,
    subtotalPen: 30,
    quantityPurchased: 3,
    weight: 1,
  },
  {
    id: "b",
    unitCostPen: 5,
    subtotalPen: 10,
    quantityPurchased: 2,
    weight: 1,
  },
];

section("Distribucion por valor");
{
  const dist = distributeByValue(valueItems, 100);
  assertEq("Item a recibe 75 cents", dist.get("a"), 75);
  assertEq("Item b recibe 25 cents", dist.get("b"), 25);
  assertEq(
    "Suma exacta de adicionales por valor",
    Array.from(dist.values()).reduce((sum, value) => sum + value, 0),
    100,
  );
}

section("Distribucion por peso");
{
  const items: CostInput[] = [
    { id: "a", unitCostPen: 10, subtotalPen: 10, quantityPurchased: 1, weight: 0.1 },
    { id: "b", unitCostPen: 10, subtotalPen: 10, quantityPurchased: 1, weight: 0.2 },
  ];
  const dist = distributeByWeight(items, 100);
  assertEq("Peso a recibe 33 cents", dist.get("a"), 33);
  assertEq("Peso b recibe 67 cents", dist.get("b"), 67);
  assertEq(
    "Suma exacta de adicionales por peso",
    Array.from(dist.values()).reduce((sum, value) => sum + value, 0),
    100,
  );
}

section("Distribucion mixta");
{
  const dist = distributeMixed(valueItems, 100, 50, 50);
  assertEq(
    "Suma exacta de adicionales mixtos",
    Array.from(dist.values()).reduce((sum, value) => sum + value, 0),
    100,
  );
}

section("Errores de distribucion");
expectThrow(
  "Valor total cero",
  () =>
    distributeByValue(
      [{ id: "a", unitCostPen: 0, subtotalPen: 0, quantityPurchased: 1, weight: 1 }],
      100,
    ),
  "ZERO_TOTAL_VALUE",
);
expectThrow(
  "Peso total cero",
  () =>
    distributeByWeight(
      [{ id: "a", unitCostPen: 1, subtotalPen: 1, quantityPurchased: 1, weight: 0 }],
      100,
    ),
  "ZERO_TOTAL_WEIGHT",
);
expectThrow(
  "Mixto porcentajes invalidos",
  () => distributeMixed(valueItems, 100, 40, 40),
  "INVALID_MIX_PERCENTS",
);

section("Largest Remainder exacto");
{
  const result = calculateLandedCosts(
    [{ id: "a", unitCostPen: 10, subtotalPen: 30, quantityPurchased: 3, weight: 1 }],
    {
      method: "BY_VALUE",
      totalAdditionalCostsUsd: 0,
      totalAdditionalCostsPen: 1,
      exchangeRate: 1,
    },
  );
  assertEq("Subtotal adicional exacto 1.00", result.items[0].additionalSubtotalPen, 1);
  assertEq("Subtotal aterrizado exacto 31.00", result.items[0].landedSubtotalPen, 31);
  assertNear("Unitario derivado 10.3333", result.items[0].landedUnitCostPen, 10.3333);
  assertEq("Total aterrizado exacto", result.totalLandedPen, 31);
}

section("Calculo aterrizado BY_VALUE");
{
  const items: CostInput[] = [
    { id: "a", unitCostPen: 187.5, subtotalPen: 1875, quantityPurchased: 10, weight: 1 },
    { id: "b", unitCostPen: 375, subtotalPen: 1875, quantityPurchased: 5, weight: 2 },
  ];
  const result = calculateLandedCosts(items, {
    method: "BY_VALUE",
    totalAdditionalCostsUsd: 50,
    totalAdditionalCostsPen: 100,
    exchangeRate: 3.75,
  });
  assertEq("Adicional total exacto", result.breakdown.totalAdditionalPen, 287.5);
  assertEq(
    "Total aterrizado = base + adicionales",
    result.totalLandedPen,
    1875 + 1875 + 287.5,
  );
  assertEq(
    "Suma de lineas = total aterrizado",
    Number(
      result.items.reduce((sum, item) => sum + item.landedSubtotalPen, 0).toFixed(2),
    ),
    result.totalLandedPen,
  );
}

section("Calculo aterrizado MIXED");
{
  const items: CostInput[] = [
    { id: "a", unitCostPen: 100, subtotalPen: 1000, quantityPurchased: 10, weight: 2 },
    { id: "b", unitCostPen: 200, subtotalPen: 1000, quantityPurchased: 5, weight: 4 },
  ];
  const result = calculateLandedCosts(items, {
    method: "MIXED",
    valuePercent: 70,
    weightPercent: 30,
    totalAdditionalCostsUsd: 0,
    totalAdditionalCostsPen: 10,
    exchangeRate: 1,
  });
  assertEq("Adicional total mixto exacto", result.breakdown.totalAdditionalPen, 10);
  assertEq(
    "Suma exacta de subtotales mixtos",
    Number(result.items.reduce((sum, item) => sum + item.additionalSubtotalPen, 0).toFixed(2)),
    10,
  );
}

section("Pricing");
{
  const pricing = getItemPricing(100, 150, {
    minimumTargetMarginBps: 2500,
    objectiveTargetMarginBps: 4000,
  });
  assertNear("Minimo 133.33", pricing.minimumPrice, 133.3333, 0.01);
  assertNear("Sugerido 166.66", pricing.suggestedPrice, 166.6666, 0.01);
  assertNear("Margen actual 33.33", pricing.currentMarginPercent, 33.3333, 0.01);
}

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
if (failed > 0) {
  process.exit(1);
}
