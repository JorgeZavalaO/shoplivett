// Tests de dominio Sprint 24: financial dashboard.
// Cubre overview, valorizacion de stock, capital en lotes, top/bottom
// productos, rotacion baja, rentabilidad por lote y alertas.
//
// Se ejecuta con: pnpm tsx scripts/_with-env.ts scripts/test-financial-dashboard.ts
// Corre contra la base de datos real porque las funciones de dominio
// requieren transacciones Prisma.

import assert from "node:assert/strict";

import { prisma } from "../lib/prisma";
import {
  getBatchProfitability,
  getFinancialAlerts,
  getFinancialOverview,
  getLowRotationProducts,
  getOpenBatchCapital,
  getProductProfitability,
  getStockValuation,
  monthRange,
  safeSalesChannel,
  safeYearMonth,
} from "../lib/financial-dashboard";
import { centsToDecimalString, toCents } from "../lib/money";

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

async function ensureCustomer(stamp: number) {
  const phone = `+5199${String(stamp).slice(-9)}`;
  return prisma.customer.upsert({
    where: { whatsapp: phone },
    update: { name: `ST24 Customer ${stamp}` },
    create: {
      name: `ST24 Customer ${stamp}`,
      searchName: `st24 customer ${stamp}`.toLowerCase(),
      whatsapp: phone,
      status: "ACTIVE",
      isActive: true,
    },
  });
}

async function ensureCategory(stamp: number) {
  const slug = `st24-cat-${stamp}`;
  return prisma.category.upsert({
    where: { slug },
    update: {},
    create: { name: `ST24 Cat ${stamp}`, slug, isActive: true },
  });
}

async function ensureProductWithVariant(
  stamp: number,
  categoryId: string,
  suffix: string,
  opts: { price: string; cost: string; stock: number },
) {
  const product = await prisma.product.create({
    data: {
      name: `ST24 Product ${stamp} ${suffix}`,
      isActive: true,
      categoryId,
    },
  });
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      code: `ST24-${stamp}-${suffix}`.slice(0, 32),
      price: opts.price,
      cost: opts.cost,
      stock: opts.stock,
      reservedStock: 0,
      soldStock: 0,
      status: "ACTIVE",
    },
  });
  return { product, variant };
}

async function main() {
  console.log("Sprint 24 - test-financial-dashboard");
  await ensureAdmin();
  const stamp = Date.now();
  const year = nowYear();
  const month = nowMonth();
  const customer = await ensureCustomer(stamp);
  const category = await ensureCategory(stamp);
  const { variant: variantHigh } = await ensureProductWithVariant(
    stamp,
    category.id,
    "HIGH",
    { price: "200.00", cost: "60.0000", stock: 5 },
  );
  const { variant: variantLow } = await ensureProductWithVariant(
    stamp,
    category.id,
    "LOW",
    { price: "100.00", cost: "95.0000", stock: 3 },
  );
  const { variant: variantStale } = await ensureProductWithVariant(
    stamp,
    category.id,
    "STALE",
    { price: "150.00", cost: "40.0000", stock: 4 },
  );

  // Crear lote con la variante de alto margen.
  const batch = await prisma.importBatch.create({
    data: {
      code: `ST24-LOTE-${stamp}`,
      purchaseDate: new Date(),
      shopper: "Tester",
      agency: "Test",
      totalCostUsd: "0.00",
      exchangeRate: "3.7500",
      totalInvestmentPen: "300.00",
      status: "COMPLETE",
      distributionMethod: "MIXED",
      lastRecalculatedAt: new Date(),
    },
  });
  await prisma.importBatchItem.create({
    data: {
      batchId: batch.id,
      variantId: variantHigh.id,
      quantityPurchased: 5,
      quantityReceived: 5,
      quantityAvailable: 5,
      unitCostUsd: "0.0000",
      unitCostPen: "60.0000",
      weight: "0",
      subtotalUsd: "0.00",
      subtotalPen: "300.00",
      additionalCostPen: "0.0000",
      additionalSubtotalPen: "0.00",
      landedUnitCostPen: "60.0000",
      landedSubtotalPen: "300.00",
      calculatedAt: new Date(),
    },
  });

  // Crear un pedido PAID del mes actual con ambas variantes.
  const order = await prisma.order.create({
    data: {
      orderNumber: `ST24-ORD-${stamp}`,
      customerId: customer.id,
      status: "PAID",
      subtotal: "500.00",
      total: "500.00",
      balance: "0",
      validatedPaid: "500.00",
      salesChannel: "TIKTOK_LIVE",
      productCostPen: "60.00",
      grossProfitPen: "140.00",
      paymentFeePen: "0.00",
      packagingCostPen: "0.00",
      netProfitPen: "140.00",
      profitCalculatedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    },
  });

  const itemHigh = await prisma.orderItem.create({
    data: {
      orderId: order.id,
      variantId: variantHigh.id,
      quantity: 2,
      unitPrice: "200.00",
      lineTotal: "400.00",
      costSource: "BATCH",
      unitCostPen: "60.0000",
      totalCostPen: "120.00",
      netLineRevenuePen: "400.00",
      lineDiscountPen: "0.00",
      grossProfitPen: "280.00",
    },
  });
  await prisma.orderItemBatchAllocation.create({
    data: {
      orderItemId: itemHigh.id,
      batchItemId: (
        await prisma.importBatchItem.findFirst({
          where: { batchId: batch.id, variantId: variantHigh.id },
          select: { id: true },
        })
      )!.id,
      batchId: batch.id,
      variantId: variantHigh.id,
      quantity: 2,
      unitCostPen: "60.0000",
      subtotalCostPen: "120.00",
    },
  });

  await prisma.orderItem.create({
    data: {
      orderId: order.id,
      variantId: variantLow.id,
      quantity: 1,
      unitPrice: "100.00",
      lineTotal: "100.00",
      costSource: "LEGACY",
      unitCostPen: "95.0000",
      totalCostPen: "95.00",
      netLineRevenuePen: "100.00",
      lineDiscountPen: "0.00",
      grossProfitPen: "5.00",
    },
  });

  await run("monthRange cubre el mes completo", () => {
    const { gte, lte } = monthRange(year, month);
    assert.equal(gte.getFullYear(), year);
    assert.equal(gte.getMonth(), month - 1);
    assert.equal(gte.getDate(), 1);
    assert.equal(lte.getHours(), 23);
  });

  await run("safeYearMonth acepta valores validos y sanea invalidos", () => {
    const a = safeYearMonth(String(year), String(month));
    assert.deepEqual(a, { year, month });
    const b = safeYearMonth("1990", "40");
    assert.deepEqual(b, { year: nowYear(), month: nowMonth() });
  });

  await run("safeSalesChannel normaliza valores", () => {
    assert.equal(safeSalesChannel("ALL"), "ALL");
    assert.equal(safeSalesChannel("TIKTOK_LIVE"), "TIKTOK_LIVE");
    assert.equal(safeSalesChannel("invalid"), "ALL");
    assert.equal(safeSalesChannel(undefined), "ALL");
  });

  await run(
    "getFinancialOverview suma revenue, costo y utilidad del mes",
    async () => {
      const overview = await getFinancialOverview({ year, month });
      assert.ok(
        overview.revenueCents >= 50000,
        `esperaba revenueCents >= 50000, obtuvo ${overview.revenueCents}`,
      );
      assert.equal(overview.revenue, centsToDecimalString(overview.revenueCents));
      assert.ok(
        overview.grossProfitCents >= 0,
        `esperaba grossProfitCents >= 0, obtuvo ${overview.grossProfitCents}`,
      );
      assert.equal(overview.ordersCount >= 1, true);
      assert.equal(overview.marginBps, Math.round((overview.realNetProfitCents * 10000) / overview.revenueCents));
    },
  );

  await run(
    "getFinancialOverview filtra por canal de venta",
    async () => {
      const overview = await getFinancialOverview({
        year,
        month,
        salesChannel: "TIKTOK_LIVE",
      });
      assert.ok(overview.revenueCents >= 50000);
      const other = await getFinancialOverview({
        year,
        month,
        salesChannel: "TIENDA",
      });
      // El pedido creado es TIKTOK_LIVE, por lo que filtrar por TIENDA
      // debe excluirlo.
      assert.equal(other.ordersCount === 0, true);
    },
  );

  await run("getStockValuation incluye unidades y separa legado vs lote", async () => {
    const valuation = await getStockValuation();
    assert.ok(valuation.totalUnits >= 12, `esperaba >= 12 uds, obtuvo ${valuation.totalUnits}`);
    assert.ok(valuation.variantsWithBatches >= 1);
    assert.ok(valuation.totalCents > 0);
  });

  await run("getOpenBatchCapital suma inversion y separa por estado", async () => {
    const capital = await getOpenBatchCapital();
    assert.ok(capital.totalBatches >= 1);
    assert.ok(capital.totalInvestmentCents >= 30000);
    assert.equal(
      capital.byStatus.find((s) => s.status === "COMPLETE")!.batches >= 1,
      true,
    );
  });

  await run(
    "getProductProfitability TOP incluye la variante de mayor utilidad",
    async () => {
      const { rows } = await getProductProfitability({
        year,
        month,
        order: "TOP",
        limit: 5,
      });
      assert.ok(rows.length >= 1);
      const top = rows[0];
      assert.equal(top.variantId, variantHigh.id);
      assert.ok(top.grossProfitCents >= 28000);
    },
  );

  await run(
    "getProductProfitability BOTTOM expone la variante con menor margen",
    async () => {
      const { rows } = await getProductProfitability({
        year,
        month,
        order: "BOTTOM",
        limit: 5,
      });
      assert.ok(rows.length >= 2);
      const bottom = rows[0];
      assert.ok(
        bottom.grossProfitCents <= rows[rows.length - 1].grossProfitCents,
        "BOTTOM debe estar ordenado ascendente por utilidad",
      );
      assert.ok(
        bottom.marginBps < 1500,
        `esperaba margen bajo, obtuvo ${bottom.marginBps}`,
      );
    },
  );

  await run("getLowRotationProducts detecta la variante sin ventas", async () => {
    const { rows, thresholdDays } = await getLowRotationProducts(60, 100);
    assert.equal(thresholdDays, 60);
    const has = rows.find((r) => r.variantId === variantStale.id);
    assert.ok(has, "La variante STALE debe aparecer como sin rotacion");
    assert.equal(has!.stock >= 4, true);
  });

  await run("getBatchProfitability reconoce utilidad del lote sembrado", async () => {
    const { rows } = await getBatchProfitability({ year, month, limit: 10 });
    const found = rows.find((r) => r.batchId === batch.id);
    assert.ok(found, "El lote sembrado debe estar en la lista");
    assert.equal(found!.soldUnits, 2);
    assert.equal(found!.allocatedRevenueCents, 40000);
  });

  await run("getFinancialAlerts devuelve al menos un array", async () => {
    const alerts = await getFinancialAlerts({ year, month });
    assert.ok(Array.isArray(alerts.alerts));
    assert.ok(typeof alerts.minimumMarginBps === "number");
  });

  // Limpieza.
  try {
    await prisma.orderItemBatchAllocation.deleteMany({
      where: { batchId: batch.id },
    });
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.payment.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.importBatchItem.deleteMany({ where: { batchId: batch.id } });
    await prisma.importBatch.delete({ where: { id: batch.id } });
    await prisma.productVariant.deleteMany({
      where: { id: { in: [variantHigh.id, variantLow.id, variantStale.id] } },
    });
    await prisma.product.deleteMany({
      where: { name: { startsWith: `ST24 Product ${stamp}` } },
    });
    await prisma.category.deleteMany({ where: { id: category.id } });
    await prisma.customer.delete({ where: { id: customer.id } });
  } catch (cleanupError) {
    console.warn("Aviso: limpieza parcial fallo", cleanupError);
  }

  console.log(`\nTotal: ${passed} ok / ${failed} fail`);
  await prisma.$disconnect();
  if (failed > 0) process.exit(1);
}

void toCents;
main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
