import assert from "node:assert/strict";

import { prisma } from "../lib/prisma";
import { createShipment, updateShipment, cancelShipment } from "../lib/shipments";

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
    update: { standardPackagingCostPen: "2.00" },
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
  console.log("Sprint 28 - test-shipment-real-cost");
  const admin = await ensureAdmin();
  await ensureSettings();
  const stamp = Date.now();

  const customer = await prisma.customer.create({
    data: {
      name: `ST28 Shipment ${stamp}`,
      searchName: `st28 shipment ${stamp}`,
      whatsapp: `+5196${String(stamp).slice(-8)}`,
      status: "ACTIVE",
      isActive: true,
    },
  });

  const category = await prisma.category.create({
    data: { name: `ST28 Shipment Cat ${stamp}`, slug: `st28-shipment-cat-${stamp}`, isActive: true },
  });

  const product = await prisma.product.create({
    data: { name: `ST28 Shipment Product ${stamp}`, categoryId: category.id, isActive: true },
  });

  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      code: `ST28-SHIP-${stamp}`.slice(0, 32),
      price: "100.00",
      cost: "30.0000",
      stock: 5,
      reservedStock: 0,
      soldStock: 1,
      status: "ACTIVE",
    },
  });

  const order = await prisma.order.create({
    data: {
      orderNumber: `ST28-SHIP-ORD-${stamp}`,
      customerId: customer.id,
      status: "PAID",
      subtotal: "100.00",
      total: "100.00",
      balance: "0.00",
      validatedPaid: "100.00",
      expiresAt: new Date(Date.now() + 3600000),
      salesChannel: "WHATSAPP_DIRECTO",
      productCostPen: "30.00",
      grossProfitPen: "70.00",
      paymentFeePen: "0.00",
      packagingCostPen: "2.00",
      deliveryBusinessCostPen: "0.00",
      netProfitPen: "68.00",
      profitCalculatedAt: new Date(),
    },
  });

  await prisma.orderItem.create({
    data: {
      orderId: order.id,
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

  const created = await createShipment({
    customerId: customer.id,
    shippingMethod: "OLVA",
    orderIds: [order.id],
    shippingCost: "0.00",
    realCost: "30.00",
    createdById: admin.id,
    actorId: admin.id,
  });

  await run("createShipment asigna costo real y recalcula utilidad", async () => {
    const refreshed = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      select: { deliveryBusinessCostPen: true, netProfitPen: true },
    });
    assert.equal(refreshed.deliveryBusinessCostPen.toString(), "30");
    assert.equal(refreshed.netProfitPen.toString(), "38");
  });

  await updateShipment({
    shipmentId: created.shipmentId,
    realCost: "50.00",
    updatedById: admin.id,
    actorId: admin.id,
  });

  await run("updateShipment vuelve a prorratear y recalcula utilidad", async () => {
    const refreshed = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      select: { deliveryBusinessCostPen: true, netProfitPen: true },
    });
    assert.equal(refreshed.deliveryBusinessCostPen.toString(), "50");
    assert.equal(refreshed.netProfitPen.toString(), "18");
  });

  await cancelShipment({
    shipmentId: created.shipmentId,
    reason: "Cambio de agencia",
    actorId: admin.id,
  });

  await run("cancelShipment remueve costo real del pedido", async () => {
    const refreshed = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      select: { deliveryBusinessCostPen: true, netProfitPen: true },
    });
    assert.equal(refreshed.deliveryBusinessCostPen.toString(), "0");
    assert.equal(refreshed.netProfitPen.toString(), "68");
  });

  try {
    await prisma.shipmentOrder.deleteMany({ where: { orderId: order.id } });
    await prisma.shipment.deleteMany({ where: { id: created.shipmentId } });
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
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
