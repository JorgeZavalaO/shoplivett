// Regresiones AUD-DATA-014 y AUD-DATA-013.
// Uso: pnpm exec tsx scripts/_with-env.ts scripts/test-payment-reservation-closure.ts

import assert from "node:assert/strict";

import { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { closeUnpaidReservation } from "../lib/order-expiry";
import { PaymentError, validatePayment } from "../lib/payments";

const stamp = Date.now();
const prefix = `AUDPAY-${stamp}`;
let variantSeq = 0;

async function createCustomer() {
  return prisma.customer.create({
    data: {
      name: `${prefix} Customer`,
      searchName: `${prefix} customer`.toLowerCase(),
      whatsapp: `+519${String(stamp).slice(-8)}`,
      status: "ACTIVE",
      isActive: true,
    },
  });
}

async function createVariant(reservedStock: number) {
  variantSeq += 1;
  const category = await prisma.category.create({
    data: {
      name: `${prefix} Category ${variantSeq}`,
      slug: `${prefix.toLowerCase()}-${variantSeq}`,
      isActive: true,
    },
  });
  const product = await prisma.product.create({
    data: { name: `${prefix} Product ${variantSeq}`, categoryId: category.id, isActive: true },
  });
  return prisma.productVariant.create({
    data: {
      productId: product.id,
      code: `${prefix}-${variantSeq}`.slice(0, 32),
      price: "100.00",
      cost: "40.00",
      stock: 5,
      reservedStock,
      soldStock: 0,
      status: "ACTIVE",
    },
  });
}

async function createOrder(args: {
  customerId: string;
  variantId: string;
  suffix: string;
  status?: "PAYMENT_VALIDATION_PENDING" | "RESERVED" | "CANCELLED" | "EXPIRED";
}) {
  const order = await prisma.order.create({
    data: {
      orderNumber: `${prefix}-${args.suffix}`,
      customerId: args.customerId,
      status: args.status ?? "PAYMENT_VALIDATION_PENDING",
      subtotal: "100.00",
      discount: "0.00",
      shippingAmount: "0.00",
      total: "100.00",
      validatedPaid: "0.00",
      balance: "100.00",
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  });
  await prisma.orderItem.create({
    data: {
      orderId: order.id,
      variantId: args.variantId,
      quantity: 1,
      unitPrice: "100.00",
      lineTotal: "100.00",
      costSource: "LEGACY",
      unitCostPen: "40.0000",
      totalCostPen: "40.00",
      netLineRevenuePen: "100.00",
      lineDiscountPen: "0.00",
      grossProfitPen: "60.00",
    },
  });
  return order;
}

async function createPendingPayment(customerId: string, applications: { orderId: string; amount: string }[]) {
  const payment = await prisma.payment.create({
    data: { customerId, method: "YAPE", status: "PENDING", amount: "100.00" },
  });
  for (const app of applications) {
    await prisma.paymentApplication.create({
      data: { paymentId: payment.id, orderId: app.orderId, amount: app.amount },
    });
  }
  return payment;
}

async function run() {
  const customer = await createCustomer();
  const closedVariant = await createVariant(0);
  const closedOrder = await createOrder({
    customerId: customer.id,
    variantId: closedVariant.id,
    suffix: "CLOSED",
    status: "EXPIRED",
  });
  const closedPayment = await createPendingPayment(customer.id, [
    { orderId: closedOrder.id, amount: "100.00" },
  ]);

  await assert.rejects(
    () => validatePayment({ paymentId: closedPayment.id }),
    (error) => error instanceof PaymentError && error.code === "ORDER_CLOSED",
  );

  const singleVariant = await createVariant(1);
  const singleOrder = await createOrder({
    customerId: customer.id,
    variantId: singleVariant.id,
    suffix: "SINGLE",
  });
  const singlePayment = await createPendingPayment(customer.id, [
    { orderId: singleOrder.id, amount: "100.00" },
  ]);

  await prisma.$transaction(
    (tx) => closeUnpaidReservation({ orderId: singleOrder.id, reason: "EXPIRED", tx }),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  const rejected = await prisma.payment.findUniqueOrThrow({ where: { id: singlePayment.id } });
  assert.equal(rejected.status, "REJECTED");

  const multiVariantA = await createVariant(1);
  const multiVariantB = await createVariant(1);
  const orderA = await createOrder({ customerId: customer.id, variantId: multiVariantA.id, suffix: "MULTIA" });
  const orderB = await createOrder({ customerId: customer.id, variantId: multiVariantB.id, suffix: "MULTIB" });
  const multiPayment = await createPendingPayment(customer.id, [
    { orderId: orderA.id, amount: "50.00" },
    { orderId: orderB.id, amount: "50.00" },
  ]);

  await prisma.$transaction(
    (tx) => closeUnpaidReservation({ orderId: orderA.id, reason: "EXPIRED", tx }),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  const pending = await prisma.payment.findUniqueOrThrow({ where: { id: multiPayment.id } });
  assert.equal(pending.status, "PENDING");
  const remainingApps = await prisma.paymentApplication.findMany({ where: { paymentId: multiPayment.id } });
  assert.deepEqual(remainingApps.map((app) => app.orderId), [orderB.id]);

  console.log("AUD-DATA-014/AUD-DATA-013 ok");
}

async function cleanup() {
  await prisma.paymentApplication.deleteMany({ where: { payment: { customer: { name: { startsWith: prefix } } } } });
  await prisma.payment.deleteMany({ where: { customer: { name: { startsWith: prefix } } } });
  await prisma.orderItemBatchAllocation.deleteMany({ where: { orderItem: { order: { customer: { name: { startsWith: prefix } } } } } });
  await prisma.orderItem.deleteMany({ where: { order: { customer: { name: { startsWith: prefix } } } } });
  await prisma.order.deleteMany({ where: { customer: { name: { startsWith: prefix } } } });
  await prisma.inventoryMovement.deleteMany({ where: { variant: { product: { name: { startsWith: prefix } } } } });
  await prisma.productVariant.deleteMany({ where: { product: { name: { startsWith: prefix } } } });
  await prisma.product.deleteMany({ where: { name: { startsWith: prefix } } });
  await prisma.category.deleteMany({ where: { name: { startsWith: prefix } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: prefix } } });
}

run()
  .finally(cleanup)
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
