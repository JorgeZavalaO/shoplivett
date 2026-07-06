import assert from "node:assert/strict";

import { prisma } from "../lib/prisma";
import { getLivesReport, getTopProductsReport } from "../lib/reports";
import { getExpensesReport } from "../lib/financial-reports";

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

async function ensureSettings() {
  return prisma.businessSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      reservationDays: 5,
      minimumAdvance: "50.00",
      currency: "PEN",
      freeShippingEnabled: true,
      freeShippingThreshold: "150.00",
      productCodePrefix: "CART",
      allowOverpaymentCredit: true,
      allowRefund: true,
      enabledPaymentMethods: ["YAPE", "PLIN"],
      enabledShippingMethods: ["DELIVERY_PROPIO", "OLVA", "SHALOM", "MOTORIZADO", "RECOJO"],
      paymentValidatorRoles: ["ADMIN", "SELLER"],
      defaultExchangeRate: "3.7500",
      minimumTargetMarginBps: 1500,
      objectiveTargetMarginBps: 3000,
      defaultCostAllocationMethod: "MIXED",
      mixedValueAllocationPercent: 50,
      mixedWeightAllocationPercent: 50,
      standardPackagingCostPen: "2.00",
      paymentMethodFees: { YAPE: 0, PLIN: 0, CASH: 0, OTHER: 0 },
      enabledSalesChannels: ["TIKTOK_LIVE", "INSTAGRAM_LIVE", "TIENDA", "WHATSAPP_DIRECTO"],
    },
  });
}

async function main() {
  console.log("Sprint 28 - test-reports");
  const admin = await ensureAdmin();
  await ensureSettings();
  const stamp = Date.now();
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;

  const customer = await prisma.customer.create({
    data: {
      name: `ST28 Customer ${stamp}`,
      searchName: `st28 customer ${stamp}`,
      whatsapp: `+5197${String(stamp).slice(-8)}`,
      status: "ACTIVE",
      isActive: true,
    },
  });

  const category = await prisma.category.create({
    data: {
      name: `ST28 Cat ${stamp}`,
      slug: `st28-cat-${stamp}`,
      isActive: true,
    },
  });

  const product = await prisma.product.create({
    data: { name: `ST28 Product ${stamp}`, categoryId: category.id, isActive: true },
  });

  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      code: `ST28-VAR-${stamp}`.slice(0, 32),
      price: "100.00",
      cost: "30.0000",
      stock: 10,
      reservedStock: 0,
      soldStock: 3,
      status: "ACTIVE",
    },
  });

  const liveA = await prisma.liveSession.create({
    data: { name: `ST28 Live A ${stamp}`, channel: "TIKTOK", status: "OPEN", responsibleId: admin.id },
  });
  const liveB = await prisma.liveSession.create({
    data: { name: `ST28 Live B ${stamp}`, channel: "INSTAGRAM", status: "OPEN", responsibleId: admin.id },
  });

  const paidOrder = await prisma.order.create({
    data: {
      orderNumber: `ST28-LIVE-A-${stamp}`,
      customerId: customer.id,
      liveSessionId: liveA.id,
      status: "PAID",
      subtotal: "100.00",
      total: "100.00",
      balance: "0.00",
      validatedPaid: "100.00",
      expiresAt: new Date(Date.now() + 3600000),
      salesChannel: "TIKTOK_LIVE",
      productCostPen: "30.00",
      grossProfitPen: "70.00",
      paymentFeePen: "0.00",
      packagingCostPen: "0.00",
      deliveryBusinessCostPen: "0.00",
      netProfitPen: "70.00",
      profitCalculatedAt: new Date(),
    },
  });
  await prisma.orderItem.create({
    data: {
      orderId: paidOrder.id,
      variantId: variant.id,
      quantity: 1,
      unitPrice: "100.00",
      lineTotal: "100.00",
      costSource: "LEGACY",
      unitCostPen: "30.0000",
      totalCostPen: "30.00",
      netLineRevenuePen: "100.00",
      lineDiscountPen: "0.00",
      grossProfitPen: "70.00",
    },
  });

  await prisma.order.create({
    data: {
      orderNumber: `ST28-LIVE-B-RES-${stamp}`,
      customerId: customer.id,
      liveSessionId: liveB.id,
      status: "RESERVED",
      subtotal: "80.00",
      total: "80.00",
      balance: "60.00",
      validatedPaid: "20.00",
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  await prisma.order.create({
    data: {
      orderNumber: `ST28-LIVE-B-PEND-${stamp}`,
      customerId: customer.id,
      liveSessionId: liveB.id,
      status: "PAYMENT_VALIDATION_PENDING",
      subtotal: "40.00",
      total: "40.00",
      balance: "40.00",
      validatedPaid: "0.00",
      expiresAt: new Date(Date.now() + 3600000),
    },
  });

  const expenses: string[] = [];
  for (let i = 0; i < 120; i += 1) {
    const expense = await prisma.expense.create({
      data: {
        expenseDate: new Date(year, month - 1, 10),
        category: "ADVERTISING",
        expenseType: "VARIABLE",
        status: "ACTIVE",
        description: `ST28 gasto ${stamp}-${i}`,
        amount: "1.00",
        createdById: admin.id,
      },
      select: { id: true },
    });
    expenses.push(expense.id);
  }

  await run("getLivesReport agrupa métricas por live real", async () => {
    const report = await getLivesReport({ from: null, to: null, page: 1, perPage: 20 });
    const rowA = report.items.find((row) => row.id === liveA.id);
    const rowB = report.items.find((row) => row.id === liveB.id);
    assert.ok(rowA, "live A debe estar en el reporte");
    assert.ok(rowB, "live B debe estar en el reporte");
    assert.equal(rowA!.pedidosTotal, "100.00");
    assert.equal(rowA!.cobradoTotal, "100.00");
    assert.equal(rowA!.pendienteTotal, "0.00");
    assert.equal(rowB!.pedidosTotal, "120.00");
    assert.equal(rowB!.cobradoTotal, "20.00");
    assert.equal(rowB!.pendienteTotal, "100.00");
    assert.notEqual(rowA!.pedidosTotal, rowB!.pedidosTotal);
  });

  await run("getTopProductsReport histórico calcula revenue real", async () => {
    const report = await getTopProductsReport({ from: null, to: null, limit: 10, categoryId: category.id });
    const row = report.items.find((item) => item.variantId === variant.id);
    assert.ok(row, "la variante histórica debe aparecer");
    assert.equal(row!.revenueCents, 10000);
    assert.equal(report.totals.revenueCents >= 10000, true);
  });

  await run("getExpensesReport expone truncamiento visible", async () => {
    const report = await getExpensesReport({
      year,
      month,
      category: "ALL",
      type: "ALL",
      status: "ALL",
      page: 1,
      perPage: 50,
    });
    assert.equal(report.rows.length, 50);
    assert.equal(report.meta.truncated, true);
    assert.equal(report.meta.totalRows! >= 120, true);
  });

  try {
    await prisma.expense.deleteMany({ where: { id: { in: expenses } } });
    await prisma.orderItem.deleteMany({ where: { orderId: paidOrder.id } });
    await prisma.order.deleteMany({ where: { customerId: customer.id } });
    await prisma.liveSession.deleteMany({ where: { id: { in: [liveA.id, liveB.id] } } });
    await prisma.productVariant.delete({ where: { id: variant.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.category.delete({ where: { id: category.id } });
    await prisma.customer.delete({ where: { id: customer.id } });
  } catch (cleanupError) {
    console.warn("Aviso: limpieza parcial fallo", cleanupError);
  }

  console.log(`\nTotal: ${passed} ok / ${failed} fail`);
  await prisma.$disconnect();
  if (failed > 0) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
