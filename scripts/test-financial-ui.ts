// Tests puros Sprint 26: helpers de clasificación visual financiera.
//
// Se ejecuta con: pnpm tsx scripts/test-financial-ui.ts

import assert from "node:assert/strict";

import {
  batchHealthLabel,
  classifyBatchHealth,
  classifyIncidentImpact,
  classifyMarginBps,
  classifyMarginPercent,
  classifyRotation,
  classifyStockHealth,
  incidentImpactLabel,
  isBelowMinimumPrice,
  marginLabel,
  rotationLabel,
  stockHealthLabel,
} from "../lib/financial-ui";

let passed = 0;
let failed = 0;

async function run(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  fail ${name}`);
    console.error(error);
  }
}

async function main() {
  console.log("Sprint 26 - test-financial-ui");

  await run("classifyMarginBps clasifica loss/low/medium/high", () => {
    assert.equal(classifyMarginBps(-1), "loss");
    assert.equal(classifyMarginBps(1499), "low");
    assert.equal(classifyMarginBps(1500), "medium");
    assert.equal(classifyMarginBps(2999), "medium");
    assert.equal(classifyMarginBps(3000), "high");
  });

  await run("classifyMarginPercent reutiliza los umbrales correctos", () => {
    assert.equal(classifyMarginPercent(-0.5), "loss");
    assert.equal(classifyMarginPercent(10), "low");
    assert.equal(classifyMarginPercent(20), "medium");
    assert.equal(classifyMarginPercent(35), "high");
  });

  await run("labels de margen son consistentes", () => {
    assert.equal(marginLabel("loss"), "Pérdida");
    assert.equal(marginLabel("low"), "Margen bajo");
    assert.equal(marginLabel("medium"), "Margen medio");
    assert.equal(marginLabel("high"), "Margen alto");
  });

  await run("classifyBatchHealth prioriza pending y pérdida", () => {
    assert.equal(classifyBatchHealth({ status: "PURCHASED", marginBps: 4000 }), "pending");
    assert.equal(classifyBatchHealth({ status: "COMPLETE", marginBps: -100 }), "loss");
    assert.equal(classifyBatchHealth({ status: "COMPLETE", marginBps: 1000 }), "low");
    assert.equal(classifyBatchHealth({ status: "COMPLETE", marginBps: 2000 }), "medium");
    assert.equal(classifyBatchHealth({ status: "COMPLETE", marginBps: 3500 }), "high");
    assert.equal(batchHealthLabel("low"), "Rentabilidad baja");
  });

  await run("classifyStockHealth detecta agotado/bajo/disponible", () => {
    assert.equal(classifyStockHealth(0), "out");
    assert.equal(classifyStockHealth(2), "low");
    assert.equal(classifyStockHealth(5), "healthy");
    assert.equal(stockHealthLabel("out"), "Agotado");
  });

  await run("classifyRotation detecta fresh/aging/stale/never", () => {
    assert.equal(classifyRotation(null, 60), "never");
    assert.equal(classifyRotation(10, 60), "fresh");
    assert.equal(classifyRotation(40, 60), "aging");
    assert.equal(classifyRotation(60, 60), "stale");
    assert.equal(rotationLabel("never"), "Nunca vendido");
  });

  await run("classifyIncidentImpact detecta cancelada, pérdida y recuperado", () => {
    assert.equal(
      classifyIncidentImpact({ status: "CANCELLED", lostCents: 1000, recoveredCents: 0 }),
      "cancelled",
    );
    assert.equal(
      classifyIncidentImpact({ status: "RESOLVED", lostCents: 1000, recoveredCents: 0 }),
      "loss",
    );
    assert.equal(
      classifyIncidentImpact({ status: "RESOLVED", lostCents: 0, recoveredCents: 2000 }),
      "recovered",
    );
    assert.equal(incidentImpactLabel("warning"), "En revisión");
  });

  await run("isBelowMinimumPrice detecta venta debajo del umbral", () => {
    assert.equal(
      isBelowMinimumPrice({ effectiveUnitPrice: 79.99, minimumPrice: 80 }),
      true,
    );
    assert.equal(
      isBelowMinimumPrice({ effectiveUnitPrice: 80, minimumPrice: 80 }),
      false,
    );
  });

  console.log(`\nTotal: ${passed} ok / ${failed} fail`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
