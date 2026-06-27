// Tests de dominio Sprint 25: financial reports.
// Cubre los agregadores usados por las nuevas secciones de /reportes y
// la utilidad CSV.
//
// Se ejecuta con: pnpm tsx scripts/_with-env.ts scripts/test-financial-reports.ts
// Corre contra la base de datos real.

import assert from "node:assert/strict";

import { prisma } from "../lib/prisma";
import {
  getBatchProfitabilityReport,
  getCustomersFinancialReport,
  getExpensesReport,
  getLowRotationReport,
  getProductProfitabilityReport,
  getReturnsLossesReport,
  getSalesByMonthReport,
  getStockValuationReport,
} from "../lib/financial-reports";
import {
  buildCsv,
  centsToCsv,
  csvFilename,
  type CsvColumn,
} from "../lib/csv-export";
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
  const phone = `+5198${String(stamp).slice(-9)}`;
  return prisma.customer.upsert({
    where: { whatsapp: phone },
    update: { name: `ST25 Customer ${stamp}` },
    create: {
      name: `ST25 Customer ${stamp}`,
      searchName: `st25 customer ${stamp}`.toLowerCase(),
      whatsapp: phone,
      status: "ACTIVE",
      isActive: true,
    },
  });
}

async function ensureCategory(stamp: number) {
  const slug = `st25-cat-${stamp}`;
  return prisma.category.upsert({
    where: { slug },
    update: {},
    create: { name: `ST25 Cat ${stamp}`, slug, isActive: true },
  });
}

async function main() {
  console.log("Sprint 25 - test-financial-reports");
  await ensureAdmin();
  const stamp = Date.now();
  const year = nowYear();
  const month = nowMonth();
  const customer = await ensureCustomer(stamp);
  const category = await ensureCategory(stamp);

  // Producto con ventas y stock
  const product = await prisma.product.create({
    data: {
      name: `ST25 Product ${stamp}`,
      isActive: true,
      categoryId: category.id,
    },
  });
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      code: `ST25-VAR-${stamp}`.slice(0, 32),
      price: "120.00",
      cost: "40.0000",
      stock: 5,
      reservedStock: 0,
      soldStock: 0,
      status: "ACTIVE",
    },
  });

  // Lote
  const batch = await prisma.importBatch.create({
    data: {
      code: `ST25-LOTE-${stamp}`,
      purchaseDate: new Date(),
      shopper: "Tester",
      agency: "Test",
      totalCostUsd: "0.00",
      exchangeRate: "3.7500",
      totalInvestmentPen: "200.00",
      status: "COMPLETE",
      distributionMethod: "MIXED",
      lastRecalculatedAt: new Date(),
    },
  });
  await prisma.importBatchItem.create({
    data: {
      batchId: batch.id,
      variantId: variant.id,
      quantityPurchased: 5,
      quantityReceived: 5,
      quantityAvailable: 5,
      unitCostUsd: "0.0000",
      unitCostPen: "40.0000",
      weight: "0",
      subtotalUsd: "0.00",
      subtotalPen: "200.00",
      additionalCostPen: "0.0000",
      additionalSubtotalPen: "0.00",
      landedUnitCostPen: "40.0000",
      landedSubtotalPen: "200.00",
      calculatedAt: new Date(),
    },
  });

  // Pedido PAID con allocations
  const order = await prisma.order.create({
    data: {
      orderNumber: `ST25-ORD-${stamp}`,
      customerId: customer.id,
      status: "PAID",
      subtotal: "240.00",
      total: "240.00",
      balance: "0",
      validatedPaid: "240.00",
      salesChannel: "TIKTOK_LIVE",
      productCostPen: "80.00",
      grossProfitPen: "160.00",
      paymentFeePen: "0.00",
      packagingCostPen: "0.00",
      netProfitPen: "160.00",
      profitCalculatedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    },
  });
  const item = await prisma.orderItem.create({
    data: {
      orderId: order.id,
      variantId: variant.id,
      quantity: 2,
      unitPrice: "120.00",
      lineTotal: "240.00",
      costSource: "BATCH",
      unitCostPen: "40.0000",
      totalCostPen: "80.00",
      netLineRevenuePen: "240.00",
      lineDiscountPen: "0.00",
      grossProfitPen: "160.00",
    },
  });
  await prisma.orderItemBatchAllocation.create({
    data: {
      orderItemId: item.id,
      batchItemId: (
        await prisma.importBatchItem.findFirst({
          where: { batchId: batch.id, variantId: variant.id },
          select: { id: true },
        })
      )!.id,
      batchId: batch.id,
      variantId: variant.id,
      quantity: 2,
      unitCostPen: "40.0000",
      subtotalCostPen: "80.00",
    },
  });
  await prisma.payment.create({
    data: {
      customerId: customer.id,
      orderId: order.id,
      method: "YAPE",
      status: "VALIDATED",
      amount: "240.00",
      validatedAt: new Date(),
    },
  });

  // Gasto del mes actual
  const expense = await prisma.expense.create({
    data: {
      expenseDate: new Date(year, month - 1, 12),
      category: "ADVERTISING",
      expenseType: "VARIABLE",
      status: "ACTIVE",
      description: `ST25 gasto ${stamp}`,
      amount: "75.00",
      createdById: (
        await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } })
      ).id,
    },
  });

  // Incidencia con perdida
  const incident = await prisma.incident.create({
    data: {
      incidentDate: new Date(year, month - 1, 14),
      type: "LOSS",
      status: "RESOLVED",
      decision: "NONE",
      variantId: variant.id,
      customerId: customer.id,
      quantity: 1,
      description: `ST25 perdida ${stamp}`,
      lostAmount: "25.00",
      recoveredAmount: "0.00",
      createdById: (
        await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } })
      ).id,
      resolvedAt: new Date(),
    },
  });

  await run("csvFilename genera nombre slug con fecha", () => {
    const name = csvFilename("Reporte Ventas", new Date("2026-06-26T00:00:00Z"));
    assert.equal(name, "reporte-ventas-2026-06-26.csv");
  });

  await run("buildCsv escapa comas, comillas y saltos de linea", () => {
    const cols: Array<CsvColumn<{ a: string; b: string }>> = [
      { header: "A", value: (r) => r.a },
      { header: "B", value: (r) => r.b },
    ];
    const csv = buildCsv(
      [
        { a: "hola,mundo", b: 'con "comillas"' },
        { a: "linea\nnueva", b: "normal" },
      ],
      cols,
    );
    assert.ok(csv.startsWith("\uFEFF"));
    assert.ok(csv.includes('"hola,mundo"'));
    assert.ok(csv.includes('"con ""comillas"""'));
    assert.ok(csv.includes('"linea\nnueva"'));
  });

  await run("centsToCsv maneja null y enteros", () => {
    assert.equal(centsToCsv(null), "");
    assert.equal(centsToCsv(12345), "123.45");
    assert.equal(centsToCsv(-1500), "-15.00");
    assert.equal(centsToCsv(0), "0.00");
  });

  await run("getSalesByMonthReport incluye el mes actual", async () => {
    const range = {
      from: new Date(year, month - 1, 1),
      to: new Date(year, month, 0, 23, 59, 59, 999),
    };
    const report = await getSalesByMonthReport(range);
    const current = report.rows.find((r) => r.year === year && r.month === month);
    assert.ok(current, "Debe haber una fila para el mes actual");
    assert.ok(current!.revenueCents >= 24000);
    assert.ok(report.totals.revenueCents >= 24000);
  });

  await run("getProductProfitabilityReport devuelve la variante creada", async () => {
    const range = {
      from: new Date(year, 0, 1),
      to: new Date(year, 11, 31, 23, 59, 59, 999),
    };
    const report = await getProductProfitabilityReport(range, {
      categoryId: category.id,
      minUnits: 1,
    });
    const found = report.rows.find((r) => r.variantId === variant.id);
    assert.ok(found, "La variante con ventas debe estar");
    assert.equal(found!.unitsSold, 2);
    assert.equal(found!.revenueCents, 24000);
    assert.equal(found!.grossProfitCents, 16000);
  });

  await run("getBatchProfitabilityReport reconoce el lote sembrado", async () => {
    const range = {
      from: new Date(year, 0, 1),
      to: new Date(year, 11, 31, 23, 59, 59, 999),
    };
    const report = await getBatchProfitabilityReport(range);
    const found = report.rows.find((r) => r.batchId === batch.id);
    assert.ok(found, "Lote debe estar en el reporte");
    assert.equal(found!.soldUnits, 2);
    assert.equal(found!.allocatedRevenueCents, 24000);
    assert.equal(found!.allocatedCostCents, 8000);
  });

  await run("getStockValuationReport incluye la variante y separa legado", async () => {
    const report = await getStockValuationReport({ categoryId: category.id });
    const found = report.rows.find((r) => r.variantId === variant.id);
    assert.ok(found, "La variante con stock debe estar");
    assert.ok(found!.stock >= 3, "Stock debe ser al menos 3 tras venta de 2");
    assert.equal(found!.hasBatches, true);
  });

  await run("getLowRotationReport detecta la variante sin ventas", async () => {
    const report = await getLowRotationReport({
      days: 60,
      categoryId: category.id,
    });
    // La variante con ventas (order reciente) NO debe estar, pero su stock
    // bajo indica rotacion activa. Probamos la deteccion creando una segunda
    // variante sin ventas.
    const staleVariant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        code: `ST25-STALE-${stamp}`.slice(0, 32),
        price: "50.00",
        cost: "10.0000",
        stock: 2,
        reservedStock: 0,
        soldStock: 0,
        status: "ACTIVE",
      },
    });
    const second = await getLowRotationReport({
      days: 60,
      categoryId: category.id,
    });
    const found = second.rows.find((r) => r.variantId === staleVariant.id);
    assert.ok(found, "La variante sin ventas debe aparecer");
    assert.equal(found!.stock, 2);
    void report;
  });

  await run("getExpensesReport incluye el gasto del mes", async () => {
    const report = await getExpensesReport({
      year,
      month,
      category: "ALL",
      type: "ALL",
      status: "ALL",
      page: 1,
      perPage: 100,
    });
    const found = report.rows.find((r) => r.id === expense.id);
    assert.ok(found, "Gasto del mes debe estar");
    assert.equal(found!.amountCents, 7500);
  });

  await run("getCustomersFinancialReport agrega el cliente", async () => {
    const range = {
      from: new Date(year, 0, 1),
      to: new Date(year, 11, 31, 23, 59, 59, 999),
    };
    const report = await getCustomersFinancialReport(range, { query: customer.name });
    const found = report.rows.find((r) => r.customerId === customer.id);
    assert.ok(found, "Cliente con pedido debe estar");
    assert.ok(found!.totalBilledCents >= 24000);
    assert.ok(found!.paidOrdersCount >= 1);
  });

  await run("getReturnsLossesReport incluye la incidencia", async () => {
    const range = {
      from: new Date(year, 0, 1),
      to: new Date(year, 11, 31, 23, 59, 59, 999),
    };
    const report = await getReturnsLossesReport(range, {
      type: "ALL",
      status: "ALL",
      decision: "ALL",
    });
    const found = report.rows.find((r) => r.incidentId === incident.id);
    assert.ok(found, "Incidencia con perdida debe estar");
    assert.equal(found!.lostCents, 2500);
    assert.ok(report.totals.lostCents >= 2500);
  });

  void toCents;
  void centsToDecimalString;

  // Limpieza
  try {
    await prisma.orderItemBatchAllocation.deleteMany({
      where: { batchId: batch.id },
    });
    await prisma.payment.deleteMany({ where: { orderId: order.id } });
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.incident.deleteMany({ where: { customerId: customer.id } });
    await prisma.expense.deleteMany({ where: { id: expense.id } });
    await prisma.importBatchItem.deleteMany({ where: { batchId: batch.id } });
    await prisma.importBatch.delete({ where: { id: batch.id } });
    await prisma.productVariant.deleteMany({
      where: { productId: product.id },
    });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.category.deleteMany({ where: { id: category.id } });
    await prisma.customer.delete({ where: { id: customer.id } });
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
