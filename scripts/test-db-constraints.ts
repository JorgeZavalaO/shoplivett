import assert from "node:assert/strict";

import { prisma } from "../lib/prisma";

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

async function expectConstraintFailure(fn: () => Promise<unknown>) {
  let failedAsExpected = false;
  try {
    await fn();
  } catch {
    failedAsExpected = true;
  }
  assert.equal(failedAsExpected, true, "La operación debía fallar por CHECK constraint");
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

async function main() {
  console.log("AUD-DATA-011 - DB constraints");
  const stamp = Date.now();
  const admin = await ensureAdmin();

  const customer = await prisma.customer.create({
    data: {
      name: `CHK Customer ${stamp}`,
      searchName: `chk customer ${stamp}`,
      whatsapp: `+5195${String(stamp).slice(-8)}`,
      status: "ACTIVE",
      isActive: true,
    },
  });
  const category = await prisma.category.create({
    data: { name: `chk-cat-${stamp}`, slug: `chk-cat-${stamp}`, isActive: true },
  });
  const product = await prisma.product.create({
    data: { name: `CHK Product ${stamp}`, categoryId: category.id, isActive: true },
  });
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      code: `CHK-${stamp}`.slice(0, 32),
      price: "10.00",
      cost: "5.00",
      stock: 5,
      reservedStock: 0,
      soldStock: 0,
      status: "ACTIVE",
    },
  });
  const order = await prisma.order.create({
    data: {
      orderNumber: `CHK-ORD-${stamp}`,
      customerId: customer.id,
      status: "RESERVED",
      subtotal: "10.00",
      discount: "0.00",
      shippingAmount: "0.00",
      total: "10.00",
      validatedPaid: "0.00",
      balance: "10.00",
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  const credit = await prisma.customerCredit.create({
    data: {
      customerId: customer.id,
      origin: "MANUAL",
      status: "AVAILABLE",
      amount: "10.00",
      availableAmount: "10.00",
      createdById: admin.id,
    },
  });
  const batch = await prisma.importBatch.create({
    data: {
      code: `CHK-BATCH-${stamp}`,
      purchaseDate: new Date(),
      shopper: "Tester",
      agency: "Tester",
      totalCostUsd: "0.00",
      exchangeRate: "3.7500",
      totalInvestmentPen: "25.00",
      status: "COMPLETE",
      distributionMethod: "MIXED",
      lastRecalculatedAt: new Date(),
    },
  });
  const batchItem = await prisma.importBatchItem.create({
    data: {
      batchId: batch.id,
      variantId: variant.id,
      quantityPurchased: 5,
      quantityReceived: 5,
      quantityAvailable: 5,
      unitCostUsd: "0.0000",
      unitCostPen: "5.0000",
      weight: "0",
      subtotalUsd: "0.00",
      subtotalPen: "25.00",
      additionalCostPen: "0.0000",
      additionalSubtotalPen: "0.00",
      landedUnitCostPen: "5.0000",
      landedSubtotalPen: "25.00",
      calculatedAt: new Date(),
    },
  });

  await run("ProductVariant rechaza stock negativo", async () => {
    await expectConstraintFailure(() =>
      prisma.productVariant.update({
        where: { id: variant.id },
        data: { stock: -1 },
      }),
    );
  });

  await run("Order rechaza validatedPaid mayor que total", async () => {
    await expectConstraintFailure(() =>
      prisma.order.update({
        where: { id: order.id },
        data: { validatedPaid: "12.00" },
      }),
    );
  });

  await run("CustomerCredit rechaza availableAmount mayor que amount", async () => {
    await expectConstraintFailure(() =>
      prisma.customerCredit.update({
        where: { id: credit.id },
        data: { availableAmount: "20.00" },
      }),
    );
  });

  await run("ImportBatchItem rechaza quantityAvailable mayor que quantityReceived", async () => {
    await expectConstraintFailure(() =>
      prisma.importBatchItem.update({
        where: { id: batchItem.id },
        data: { quantityAvailable: 7 },
      }),
    );
  });

  await prisma.importBatchItem.delete({ where: { id: batchItem.id } });
  await prisma.importBatch.delete({ where: { id: batch.id } });
  await prisma.customerCredit.delete({ where: { id: credit.id } });
  await prisma.order.delete({ where: { id: order.id } });
  await prisma.productVariant.delete({ where: { id: variant.id } });
  await prisma.product.delete({ where: { id: product.id } });
  await prisma.category.delete({ where: { id: category.id } });
  await prisma.customer.delete({ where: { id: customer.id } });

  console.log(`\nTotal: ${passed} ok / ${failed} fail`);
  await prisma.$disconnect();
  if (failed > 0) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
