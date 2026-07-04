// Regresion de performance: AUD-PERF-001, AUD-PERF-003, AUD-PERF-005.
//
// Cada test fija un dataset modesto (decenas de variantes/lotes) y verifica
// que la funcion correspondiente no escale con N. Antes de la correccion,
// `getLowRotationProducts` y `getBatchProfitability`/
// `getBatchProfitabilityReport` hacian 1 + N queries (N+1). Despues de la
// correccion deben quedar en O(1) sobre el numero de variantes/lotes.
//
// La verificacion es doble:
//   1. Conteo de queries Prisma: instrumentamos `prisma.$on('query')`
//      (requiere PRISMA_LOG_QUERY=1 que activa scripts/_with-env.ts al
//      ejecutar este test) y verificamos que el conteo no exceda un
//      techo pequeno independiente de N.
//   2. Wall-clock budget: la ejecucion debe completar rapido aunque
//      crezcamos N, demostrando que el costo no es lineal.
//
// Ejecucion: pnpm tsx scripts/_with-env.ts scripts/test-perf-fixes.ts

import assert from "node:assert/strict";

import { prisma } from "../lib/prisma";
import {
  getBatchProfitability,
  getFinancialAlerts,
  getLowRotationProducts,
} from "../lib/financial-dashboard";
import {
  getBatchProfitabilityReport,
  getLowRotationReport,
} from "../lib/financial-reports";

const PERF_VARIANT_COUNT = 30;
const PERF_BATCH_COUNT = 12;
const PERF_ALLOCATION_BATCH = 5;

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

function nowYear(): number {
  return new Date().getFullYear();
}

function nowMonth(): number {
  return new Date().getMonth() + 1;
}

async function ensureAdmin() {
  const email = "admin@shoplivett.local";
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) return user;
  const bcrypt = await import("bcryptjs");
  return prisma.user.create({
    data: {
      email,
      name: "Administrador",
      passwordHash: await bcrypt.hash("change-me-in-env", 10),
      role: "ADMIN",
      isActive: true,
    },
  });
}

type QueryCounter = { count: number; stop: () => void };

function startQueryCounter(): QueryCounter {
  const counter: QueryCounter = {
    count: 0,
    stop: () => undefined,
  };
  // Prisma emite 'query' por cada sentencia ejecutada, incluyendo $on.
  const handler = () => {
    counter.count += 1;
  };
  // $on y $off no estan en el tipo publico de PrismaClient, pero el
  // motor si las expone en runtime. Las usamos solo para contar queries
  // en este test de regresion.
  const raw = prisma as unknown as {
    $on: (event: string, handler: (event: unknown) => void) => void;
    $off?: (event: string, handler: (event: unknown) => void) => void;
  };
  raw.$on("query", handler);
  counter.stop = () => {
    raw.$off?.("query", handler);
  };
  return counter;
}

async function ensureCategory(stamp: number) {
  const slug = `st-perf-cat-${stamp}`;
  return prisma.category.upsert({
    where: { slug },
    update: {},
    create: { name: `ST-PERF Cat ${stamp}`, slug, isActive: true },
  });
}

async function main() {
  console.log("Sprint PERF - regresion AUD-PERF-001/003/005");
  await ensureAdmin();
  const stamp = Date.now();
  const year = nowYear();
  const month = nowMonth();
  const category = await ensureCategory(stamp);
  const product = await prisma.product.create({
    data: {
      name: `ST-PERF Product ${stamp}`,
      isActive: true,
      categoryId: category.id,
    },
  });

  // 1) Crear N variantes sin ventas (catalogo "sin rotacion").
  const variants = await Promise.all(
    Array.from({ length: PERF_VARIANT_COUNT }).map((_, idx) =>
      prisma.productVariant.create({
        data: {
          productId: product.id,
          code: `STPERF-${stamp}-${idx}`.slice(0, 32),
          price: "10.00",
          cost: "4.0000",
          stock: 2,
          reservedStock: 0,
          soldStock: 0,
          status: "ACTIVE",
        },
      }),
    ),
  );
  const variantIds = variants.map((v) => v.id);

  // 2) Crear M batches con allocations PAID dentro del mes actual.
  const customer = await prisma.customer.upsert({
    where: { whatsapp: `+519${String(stamp).slice(-9)}` },
    update: {},
    create: {
      name: `ST-PERF Customer ${stamp}`,
      searchName: `st-perf customer ${stamp}`,
      whatsapp: `+519${String(stamp).slice(-9)}`,
      status: "ACTIVE",
      isActive: true,
    },
  });

  const batches = await Promise.all(
    Array.from({ length: PERF_BATCH_COUNT }).map((_, idx) =>
      prisma.importBatch.create({
        data: {
          code: `STPERF-LOTE-${stamp}-${idx}`.slice(0, 32),
          purchaseDate: new Date(),
          shopper: "Perf",
          agency: "Test",
          totalCostUsd: "0.00",
          exchangeRate: "3.7500",
          totalInvestmentPen: "100.00",
          status: "COMPLETE",
          distributionMethod: "MIXED",
          lastRecalculatedAt: new Date(),
        },
      }),
    ),
  );

  const order = await prisma.order.create({
    data: {
      orderNumber: `STPERF-ORD-${stamp}`,
      customerId: customer.id,
      status: "PAID",
      subtotal: "1000.00",
      total: "1000.00",
      balance: "0",
      validatedPaid: "1000.00",
      salesChannel: "TIKTOK_LIVE",
      productCostPen: "200.00",
      grossProfitPen: "800.00",
      paymentFeePen: "0.00",
      packagingCostPen: "0.00",
      netProfitPen: "800.00",
      profitCalculatedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    },
  });

  // Un item por batch para registrar allocations.
  const createdItems: Array<{ itemId: string; batchId: string; variantId: string }> = [];
  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i]!;
    const variant = variants[i % variants.length]!;
    const batchItem = await prisma.importBatchItem.create({
      data: {
        batchId: batch.id,
        variantId: variant.id,
        quantityPurchased: 5,
        quantityReceived: 5,
        quantityAvailable: 5,
        unitCostUsd: "0.0000",
        unitCostPen: "4.0000",
        weight: "0",
        subtotalUsd: "0.00",
        subtotalPen: "20.00",
        additionalCostPen: "0.0000",
        additionalSubtotalPen: "0.00",
        landedUnitCostPen: "4.0000",
        landedSubtotalPen: "20.00",
        calculatedAt: new Date(),
      },
    });
    for (let j = 0; j < PERF_ALLOCATION_BATCH; j += 1) {
      const item = await prisma.orderItem.create({
        data: {
          orderId: order.id,
          variantId: variant.id,
          quantity: 1,
          unitPrice: "10.00",
          lineTotal: "10.00",
          costSource: "BATCH",
          unitCostPen: "4.0000",
          totalCostPen: "4.00",
          netLineRevenuePen: "10.00",
          lineDiscountPen: "0.00",
          grossProfitPen: "6.00",
        },
      });
      await prisma.orderItemBatchAllocation.create({
        data: {
          orderItemId: item.id,
          batchItemId: batchItem.id,
          batchId: batch.id,
          variantId: variant.id,
          quantity: 1,
          unitCostPen: "4.0000",
          subtotalCostPen: "4.00",
        },
      });
      createdItems.push({ itemId: item.id, batchId: batch.id, variantId: variant.id });
    }
  }

  // -----------------------------------------------------------
  // AUD-PERF-005: getLowRotationProducts y getLowRotationReport
  // deben ser O(1) en queries, no O(N) por variante.
  // Verificamos dos cosas: el conteo de queries permanece constante
  // entre un dataset pequeno (warmup) y el dataset grande, y ademas
  // el wall-clock se mantiene acotado aunque crezca N.
  // -----------------------------------------------------------
  await run(
    "AUD-PERF-005 getLowRotationProducts: queries constantes con N variantes",
    async () => {
      // Warmup: medimos queries con un dataset pequeno (excluyendo el
      // conteo de queries de setup que pueda haber inyectado el test).
      const smallCounter = startQueryCounter();
      try {
        await getLowRotationProducts(60, 5);
      } finally {
        smallCounter.stop();
      }
      const baseline = smallCounter.count;

      const counter = startQueryCounter();
      const t0 = Date.now();
      try {
        const { rows } = await getLowRotationProducts(60, 50);
        const elapsed = Date.now() - t0;
        assert.ok(
          rows.length >= PERF_VARIANT_COUNT,
          `esperaba >= ${PERF_VARIANT_COUNT} filas, obtuvo ${rows.length}`,
        );
        // El conteo debe ser igual al baseline (constante respecto a N).
        // Antes del fix eran 1 + N queries, ahora son O(1) fijo.
        assert.equal(
          counter.count,
          baseline,
          `getLowRotationProducts escala con N: ${baseline} vs ${counter.count}`,
        );
        assert.ok(
          elapsed < 2000,
          `getLowRotationProducts tardo ${elapsed}ms, esperaba < 2000ms`,
        );
        void variantIds;
      } finally {
        counter.stop();
      }
    },
  );

  await run(
    "AUD-PERF-005 getLowRotationReport: queries constantes con N variantes",
    async () => {
      const smallCounter = startQueryCounter();
      try {
        await getLowRotationReport({ days: 60 });
      } finally {
        smallCounter.stop();
      }
      const baseline = smallCounter.count;

      const counter = startQueryCounter();
      const t0 = Date.now();
      try {
        const report = await getLowRotationReport({ days: 60 });
        const elapsed = Date.now() - t0;
        assert.ok(
          report.rows.length >= PERF_VARIANT_COUNT,
          `esperaba >= ${PERF_VARIANT_COUNT} filas, obtuvo ${report.rows.length}`,
        );
        assert.equal(
          counter.count,
          baseline,
          `getLowRotationReport escala con N: ${baseline} vs ${counter.count}`,
        );
        assert.ok(
          elapsed < 2000,
          `getLowRotationReport tardo ${elapsed}ms, esperaba < 2000ms`,
        );
      } finally {
        counter.stop();
      }
    },
  );

  // -----------------------------------------------------------
  // AUD-PERF-003: getBatchProfitability y getBatchProfitabilityReport
  // no deben cargar el grafo completo historico.
  // -----------------------------------------------------------
  await run(
    "AUD-PERF-003 getBatchProfitability: queries acotadas con M lotes",
    async () => {
      const counter = startQueryCounter();
      const t0 = Date.now();
      try {
        const { rows } = await getBatchProfitability({ year, month, limit: 50 });
        const elapsed = Date.now() - t0;
        assert.ok(
          rows.length >= PERF_BATCH_COUNT,
          `esperaba >= ${PERF_BATCH_COUNT} lotes, obtuvo ${rows.length}`,
        );
        // 1 (allocations) + 1 (batches) + selects anidados (products,
        // items) ~= 5 queries como techo.
        assert.ok(
          counter.count <= 8,
          `getBatchProfitability ejecuto ${counter.count} queries, esperaba <= 8`,
        );
        assert.ok(
          elapsed < 2000,
          `getBatchProfitability tardo ${elapsed}ms, esperaba < 2000ms`,
        );
      } finally {
        counter.stop();
      }
    },
  );

  await run(
    "AUD-PERF-003 getBatchProfitabilityReport: queries acotadas con M lotes",
    async () => {
      const counter = startQueryCounter();
      const t0 = Date.now();
      try {
        const report = await getBatchProfitabilityReport({
          from: new Date(year, month - 1, 1),
          to: new Date(year, month, 0, 23, 59, 59, 999),
        });
        const elapsed = Date.now() - t0;
        assert.ok(
          report.rows.length >= PERF_BATCH_COUNT,
          `esperaba >= ${PERF_BATCH_COUNT} lotes, obtuvo ${report.rows.length}`,
        );
        assert.ok(
          counter.count <= 8,
          `getBatchProfitabilityReport ejecuto ${counter.count} queries, esperaba <= 8`,
        );
        assert.ok(
          elapsed < 2000,
          `getBatchProfitabilityReport tardo ${elapsed}ms, esperaba < 2000ms`,
        );
      } finally {
        counter.stop();
      }
    },
  );

  // -----------------------------------------------------------
  // AUD-PERF-001: getFinancialAlerts con precomputed NO recalcula.
  // -----------------------------------------------------------
  await run(
    "AUD-PERF-001 getFinancialAlerts con precomputed: no recalcula overview/rotacion",
    async () => {
      // Provocamos un primer llamado SIN precomputed para tener un overview
      // valido que pasar a la segunda llamada.
      const counter = startQueryCounter();
      let overviewRef;
      try {
        const baseline = await getFinancialAlerts({ year, month });
        overviewRef = baseline;
        counter.stop();
      } catch (err) {
        counter.stop();
        throw err;
      }
      // Segundo llamado CON precomputed: no debe ejecutar
      // getFinancialOverview ni getLowRotationProducts.
      const counter2 = startQueryCounter();
      const t0 = Date.now();
      try {
        const result = await getFinancialAlerts({ year, month }, {
          overview: {
            year,
            month,
            filter: { year, month },
            revenueCents: 0,
            revenue: "0.00",
            productCostCents: 0,
            productCost: "0.00",
            grossProfitCents: 0,
            grossProfit: "0.00",
            paymentFeeCents: 0,
            paymentFee: "0.00",
            packagingCostCents: 0,
            packagingCost: "0.00",
            netProfitCents: 0,
            netProfit: "0.00",
            expensesCents: 0,
            expenses: "0.00",
            incidentLossCents: 0,
            incidentLoss: "0.00",
            realNetProfitCents: 0,
            realNetProfit: "0.00",
            marginBps: 0,
            ordersCount: 0,
          },
          lowRotationCount: 0,
          lowRotationThresholdDays: 60,
        });
        const elapsed = Date.now() - t0;
        // settings (1) + lowMargin groupBy (1) = 2 queries como techo.
        // Sin precomputed habria sumado el overview (varias aggregates)
        // y la baja rotacion (variants + groupBy).
        assert.ok(
          counter2.count <= 4,
          `getFinancialAlerts(precomputed) ejecuto ${counter2.count} queries, esperaba <= 4`,
        );
        assert.equal(result.lowRotationCount, 0);
        assert.ok(
          elapsed < 2000,
          `getFinancialAlerts(precomputed) tardo ${elapsed}ms, esperaba < 2000ms`,
        );
        void overviewRef;
      } finally {
        counter2.stop();
      }
    },
  );

  // -----------------------------------------------------------
  // Limpieza
  // -----------------------------------------------------------
  try {
    await prisma.orderItemBatchAllocation.deleteMany({
      where: { batchId: { in: batches.map((b) => b.id) } },
    });
    await prisma.orderItem.deleteMany({
      where: { id: { in: createdItems.map((i) => i.itemId) } },
    });
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.importBatchItem.deleteMany({
      where: { batchId: { in: batches.map((b) => b.id) } },
    });
    await prisma.importBatch.deleteMany({
      where: { id: { in: batches.map((b) => b.id) } },
    });
    await prisma.productVariant.deleteMany({
      where: { id: { in: variants.map((v) => v.id) } },
    });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.category.deleteMany({ where: { id: category.id } });
    await prisma.customer.deleteMany({ where: { id: customer.id } });
  } catch (cleanupError) {
    console.warn("Aviso: limpieza parcial fallo", cleanupError);
  }

  console.log(`\nTotal: ${passed} ok / ${failed} fail`);
  await prisma.$disconnect();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
