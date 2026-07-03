// Tests de dominio Sprint 21: order-batch-allocation.
// Cubre FIFO, allocations, liberación, distribución de descuento y profit.
//
// Se ejecuta con: pnpm tsx scripts/test-order-batch-fifo.ts
// Diseñado para correr contra una base de datos real (la misma que usa el
// dev) porque las funciones de dominio requieren transacciones Prisma.

import assert from "node:assert/strict";

import { prisma } from "../lib/prisma";
import {
  allocateOrderItemBatches,
  buildLineSnapshots,
  checkBatchStock,
  distributeOrderDiscount,
  persistQuickSaleLine,
  recognizeOrderProfit,
  releaseOrderItemAllocations,
  variantOperatesWithBatches,
} from "../lib/order-batch-allocation";

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

function decimalString(value: number): string {
  return value.toFixed(2);
}

async function ensureCustomer() {
  const stamp = Date.now();
  const phone = `+5199${String(stamp).slice(-9)}`;
  return prisma.customer.upsert({
    where: { whatsapp: phone },
    update: { name: `FIFO Test ${stamp}` },
    create: {
      name: `FIFO Test ${stamp}`,
      searchName: `fifo test ${stamp}`.toLowerCase(),
      whatsapp: phone,
      status: "ACTIVE",
      isActive: true,
    },
  });
}

async function ensureVariantWithBatches() {
  const stamp = Date.now();
  const category = await prisma.category.upsert({
    where: { slug: "fifo-test" },
    update: {},
    create: { name: "FIFO Test", slug: "fifo-test", isActive: true },
  });
  const product = await prisma.product.create({
    data: {
      name: `FIFO Product ${stamp}`,
      isActive: true,
      categoryId: category.id,
    },
  });
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      code: `FIFO-${stamp}`.slice(0, 32),
      price: "100.00",
      cost: "30.0000",
      stock: 4,
      reservedStock: 0,
      soldStock: 0,
      status: "ACTIVE",
    },
  });

  const oldDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
  const newDate = new Date();
  const oldBatch = await prisma.importBatch.create({
    data: {
      code: `FIFO-OLD-${stamp}`,
      purchaseDate: oldDate,
      shopper: "Test",
      agency: "Test",
      totalCostUsd: "0.00",
      exchangeRate: "3.7500",
      totalInvestmentPen: "0.00",
      status: "COMPLETE",
      distributionMethod: "MIXED",
      lastRecalculatedAt: new Date(),
    },
  });
  const newBatch = await prisma.importBatch.create({
    data: {
      code: `FIFO-NEW-${stamp}`,
      purchaseDate: newDate,
      shopper: "Test",
      agency: "Test",
      totalCostUsd: "0.00",
      exchangeRate: "3.7500",
      totalInvestmentPen: "0.00",
      status: "COMPLETE",
      distributionMethod: "MIXED",
      lastRecalculatedAt: new Date(),
    },
  });
  const oldItem = await prisma.importBatchItem.create({
    data: {
      batchId: oldBatch.id,
      variantId: variant.id,
      quantityPurchased: 2,
      quantityReceived: 2,
      quantityAvailable: 2,
      unitCostUsd: "0.0000",
      unitCostPen: "30.0000",
      weight: "0",
      subtotalUsd: "0.00",
      subtotalPen: "60.00",
      additionalCostPen: "0.0000",
      additionalSubtotalPen: "0.00",
      landedUnitCostPen: "30.0000",
      landedSubtotalPen: "60.00",
      calculatedAt: new Date(),
    },
  });
  const newItem = await prisma.importBatchItem.create({
    data: {
      batchId: newBatch.id,
      variantId: variant.id,
      quantityPurchased: 2,
      quantityReceived: 2,
      quantityAvailable: 2,
      unitCostUsd: "0.0000",
      unitCostPen: "50.0000",
      weight: "0",
      subtotalUsd: "0.00",
      subtotalPen: "100.00",
      additionalCostPen: "0.0000",
      additionalSubtotalPen: "0.00",
      landedUnitCostPen: "50.0000",
      landedSubtotalPen: "100.00",
      calculatedAt: new Date(),
    },
  });

  return { variant, oldItem, newItem };
}

async function main() {
  console.log("Sprint 21 - test-order-batch-fifo");
  const customer = await ensureCustomer();
  const { variant, oldItem, newItem } = await ensureVariantWithBatches();

  await run("variantOperatesWithBatches detecta variante con lote", async () => {
    const ok = await variantOperatesWithBatches(prisma, variant.id);
    assert.equal(ok, true);
  });

  await run("checkBatchStock pasa cuando hay stock suficiente", async () => {
    await checkBatchStock(prisma, variant.id, 3);
  });

  await run("checkBatchStock lanza INSUFFICIENT_BATCH_STOCK si falta stock", async () => {
    let threw = false;
    try {
      await checkBatchStock(prisma, variant.id, 99);
    } catch (error: unknown) {
      threw = true;
      assert.equal(
        (error as { code: string }).code,
        "INSUFFICIENT_BATCH_STOCK",
      );
    }
    assert.equal(threw, true);
  });

  let createdOrderItemId = "";
  await run("allocateOrderItemBatches FIFO consume lote antiguo primero", async () => {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber: `FIFO-T-${Date.now()}`,
          customerId: customer.id,
          status: "PAYMENT_VALIDATION_PENDING",
          subtotal: "0",
          total: "0",
          balance: "0",
          expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        },
        select: { id: true },
      });
      const orderItem = await tx.orderItem.create({
        data: {
          orderId: order.id,
          variantId: variant.id,
          quantity: 3,
          unitPrice: "100.00",
          lineTotal: "300.00",
        },
        select: { id: true },
      });
      const allocations = await allocateOrderItemBatches(
        tx,
        orderItem.id,
        variant.id,
        3,
      );
      return { orderItemId: orderItem.id, allocations };
    });
    createdOrderItemId = result.orderItemId;
    const old = result.allocations.find((a) => a.batchItemId === oldItem.id);
    const newer = result.allocations.find((a) => a.batchItemId === newItem.id);
    assert.equal(old?.quantity, 2, "Debe consumir 2 del lote antiguo");
    assert.equal(newer?.quantity, 1, "Debe consumir 1 del lote nuevo");
  });

  await run("releaseOrderItemAllocations restaura quantityAvailable", async () => {
    await prisma.$transaction(async (tx) => {
      const released = await releaseOrderItemAllocations(
        tx,
        createdOrderItemId,
      );
      assert.equal(released.length, 2);
    });
    const old = await prisma.importBatchItem.findUnique({
      where: { id: oldItem.id },
    });
    const newer = await prisma.importBatchItem.findUnique({
      where: { id: newItem.id },
    });
    assert.equal(Number(old?.quantityAvailable), 2);
    assert.equal(Number(newer?.quantityAvailable), 2);
  });

  await run("distributeOrderDiscount reparte con largest remainder", () => {
    const lines = [
      { id: "a", variantId: "a", quantity: 1, lineSubtotalCents: 3333 },
      { id: "b", variantId: "b", quantity: 1, lineSubtotalCents: 3333 },
      { id: "c", variantId: "c", quantity: 1, lineSubtotalCents: 3334 },
    ];
    const map = distributeOrderDiscount(lines, 100);
    const total = [...map.values()].reduce((acc, v) => acc + v, 0);
    assert.equal(total, 100);
  });

  await run("buildLineSnapshots calcula snapshots por línea", () => {
    const snapshots = buildLineSnapshots({
      lines: [
        {
          id: "a",
          variantId: "a",
          quantity: 1,
          unitPrice: "100.00",
          variant: { cost: { toString: () => "40.00" } },
          allocations: [],
        },
      ],
      discountCents: 0,
    });
    assert.equal(snapshots[0]?.costSource, "LEGACY");
    assert.equal(snapshots[0]?.unitCostPen, "40.0000");
    assert.equal(snapshots[0]?.grossProfitPen, "60.00");
  });

  await run("createQuickSale + validatePayment reconoce profit", async () => {
    // Se valida por flujo E2E en Playwright porque validatePayment usa
    // getSettings (unstable_cache) y requiere contexto Next. Aquí validamos
    // recognizeOrderProfit con un OrderItem sembrado directamente.
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber: `FIFO-PROFIT-${Date.now()}`,
          customerId: customer.id,
          status: "PAID",
          subtotal: "100.00",
          total: "100.00",
          balance: "0",
          validatedPaid: "100.00",
          salesChannel: "TIENDA",
          expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        },
        select: { id: true },
      });
      const item = await tx.orderItem.create({
        data: {
          orderId: order.id,
          variantId: variant.id,
          quantity: 1,
          unitPrice: "100.00",
          lineTotal: "100.00",
          costSource: "BATCH",
          unitCostPen: "30.0000",
          totalCostPen: "30.00",
          netLineRevenuePen: "100.00",
          lineDiscountPen: "0.00",
          grossProfitPen: "70.00",
        },
        select: { id: true },
      });
      await tx.payment.create({
        data: {
          customerId: customer.id,
          orderId: order.id,
          method: "YAPE",
          status: "VALIDATED",
          amount: "100.00",
          validatedAt: new Date(),
        },
      });
      return { orderId: order.id, itemId: item.id };
    });
    const profit = await recognizeOrderProfit(prisma, result.orderId, {
      paymentMethodFees: { YAPE: 0, PLIN: 0, CASH: 0, OTHER: 0 },
      packagingCostPen: "2.00",
    });
    assert.equal(profit.productCostCents, 3000);
    assert.equal(profit.grossProfitCents, 7000);
    assert.equal(profit.packagingCostCents, 200);
    assert.equal(profit.netProfitCents, 6800);
  });

  await run("persistQuickSaleLine persiste OrderItem con allocations", async () => {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber: `FIFO-P-${Date.now()}`,
          customerId: customer.id,
          status: "PAYMENT_VALIDATION_PENDING",
          subtotal: "0",
          total: "0",
          balance: "0",
          expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        },
        select: { id: true },
      });
      return persistQuickSaleLine({
        tx,
        orderId: order.id,
        item: {
          variantId: variant.id,
          quantity: 1,
          unitPrice: "100.00",
          variant: { cost: null },
        },
      });
    });
    assert.equal(result.costSource, "BATCH");
    assert.ok(result.allocations.length >= 1);
  });

  await run(
    "persistQuickSaleLine prorratea descuento y envio en snapshots",
    async () => {
      const result = await prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            orderNumber: `FIFO-DISCOUNT-${Date.now()}`,
            customerId: customer.id,
            status: "PAYMENT_VALIDATION_PENDING",
            subtotal: "0",
            total: "0",
            balance: "0",
            expiresAt: new Date(Date.now() + 1000 * 60 * 60),
          },
          select: { id: true },
        });
        return persistQuickSaleLine({
          tx,
          orderId: order.id,
          item: {
            variantId: variant.id,
            quantity: 1,
            unitPrice: "100.00",
            variant: { cost: null },
          },
          lineDiscountCents: 1000,
          shippingAllocationCents: 200,
        });
      });
      assert.equal(result.lineDiscountPen, "10.00");
      assert.equal(result.netLineRevenuePen, "92.00");
      const orderId = result.orderItemId;
      const item = await prisma.orderItem.findUnique({
        where: { id: orderId },
        select: {
          lineDiscountPen: true,
          netLineRevenuePen: true,
          grossProfitPen: true,
        },
      });
      assert.ok(item, "item persistido debe existir");
      assert.equal(Number(item!.lineDiscountPen), 10);
      assert.equal(Number(item!.netLineRevenuePen), 92);
      const expectedGross =
        9200 -
        Math.round(
          Number(result.totalCostPen.replace(",", ".")) * 100,
        );
      assert.equal(
        Math.round(Number(item!.grossProfitPen) * 100),
        expectedGross,
      );
    },
  );

  await run("recognizeOrderProfit es idempotente", async () => {
    // Crea un pedido PAID ad-hoc para esta prueba.
    const order = await prisma.order.create({
      data: {
        orderNumber: `FIFO-IDEMPOTENT-${Date.now()}`,
        customerId: customer.id,
        status: "PAID",
        subtotal: "100.00",
        total: "100.00",
        balance: "0",
        validatedPaid: "100.00",
        salesChannel: "TIENDA",
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      },
    });
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        variantId: variant.id,
        quantity: 1,
        unitPrice: "100.00",
        lineTotal: "100.00",
        costSource: "BATCH",
        unitCostPen: "30.0000",
        totalCostPen: "30.00",
        netLineRevenuePen: "100.00",
        lineDiscountPen: "0.00",
        grossProfitPen: "70.00",
      },
    });
    await prisma.payment.create({
      data: {
        customerId: customer.id,
        orderId: order.id,
        method: "YAPE",
        status: "VALIDATED",
        amount: "100.00",
        validatedAt: new Date(),
      },
    });
    const first = await recognizeOrderProfit(prisma, order.id, {
      paymentMethodFees: { YAPE: 0, PLIN: 0, CASH: 0, OTHER: 0 },
      packagingCostPen: "2.00",
    });
    const second = await recognizeOrderProfit(prisma, order.id, {
      paymentMethodFees: { YAPE: 0, PLIN: 0, CASH: 0, OTHER: 0 },
      packagingCostPen: "2.00",
    });
    assert.equal(first.netProfitCents, second.netProfitCents);
  });

  // Limpieza de los datos sembrados.
  await prisma.orderItemBatchAllocation.deleteMany({
    where: { variantId: variant.id },
  });
  await prisma.paymentApplication.deleteMany({
    where: { order: { customerId: customer.id } },
  });
  await prisma.paymentReceipt.deleteMany({
    where: { payment: { customerId: customer.id } },
  });
  await prisma.payment.deleteMany({ where: { customerId: customer.id } });
  await prisma.customerCredit.deleteMany({
    where: { customerId: customer.id },
  });
  await prisma.shipmentOrder.deleteMany({
    where: { order: { customerId: customer.id } },
  });
  await prisma.shipment.deleteMany({ where: { customerId: customer.id } });
  await prisma.orderItem.deleteMany({ where: { variantId: variant.id } });
  await prisma.order.deleteMany({ where: { customerId: customer.id } });
  await prisma.importBatchItem.deleteMany({ where: { variantId: variant.id } });
  await prisma.importBatch.deleteMany({
    where: { code: { startsWith: "FIFO-" } },
  });
  await prisma.productVariant.delete({ where: { id: variant.id } });
  await prisma.product.deleteMany({
    where: { name: { startsWith: "FIFO Product" } },
  });
  await prisma.customer.delete({ where: { id: customer.id } });
  await prisma.category.deleteMany({ where: { slug: "fifo-test" } });

  console.log(`\nTotal: ${passed} ok / ${failed} fail`);
  await prisma.$disconnect();
  if (failed > 0) process.exit(1);
}

void decimalString;
main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
