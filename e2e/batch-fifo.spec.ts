// Pruebas E2E obligatorias para el Sprint 21 - Integración lote-stock-venta FIFO.
// Cubre:
//   - FIFO automático: la venta consume primero el lote más antiguo.
//   - Bloqueo: variante con lotes sin stock suficiente no permite venta.
//   - Fallback legado: variante sin lote sigue vendiendo con ProductVariant.cost.
//   - Cancelación: restaura ImportBatchItem.quantityAvailable.
//   - Pago PAID: congela utilidad en OrderItem y Order.
//   - Recalcular lote: no altera allocations históricas.

import { test, expect } from "./fixtures/auth";
import {
  cleanupTestData,
  createTestCustomer,
  createTestProductWithBatches,
  createTestProductWithStock,
  getAdmin,
  prisma,
} from "./fixtures/db";
import { createQuickSale, OrderError } from "../lib/sales";
import { validatePayment } from "../lib/payments";
import { expireReservation } from "../lib/order-expiry";
import { recalculateBatchAction } from "../actions/import-batches";

test.afterAll(async () => {
  await cleanupTestData();
  await prisma.$disconnect();
});

test.describe("Sprint 21 - Lote, stock y venta FIFO", () => {
  test("RF-S21-01 - FIFO consume primero el lote más antiguo", async () => {
    const { user } = await getAdmin();
    const customer = await createTestCustomer("FIFO01");
    const { variant, oldItem, newItem } = await createTestProductWithBatches({
      suffix: "FIFO01",
      oldBatch: { quantity: 3, unitCost: "30.0000" },
      newBatch: { quantity: 5, unitCost: "50.0000" },
    });

    const order = await createQuickSale({
      customerId: customer.id,
      items: [{ variantId: variant.id, quantity: 4 }],
      discount: "0",
      shippingAmount: "0",
      advanceAmount: "100",
      paymentMethod: "YAPE",
      actorId: user.id,
    });

    const orderItems = await prisma.orderItem.findMany({
      where: { orderId: order.orderId },
      include: { allocations: true },
    });
    expect(orderItems).toHaveLength(1);
    const item = orderItems[0]!;
    expect(item.costSource).toBe("BATCH");
    expect(item.allocations).toHaveLength(2);

    const totalAllocated = item.allocations.reduce(
      (acc, a) => acc + a.quantity,
      0,
    );
    expect(totalAllocated).toBe(4);
    const oldAlloc = item.allocations.find((a) => a.batchItemId === oldItem.id);
    const newAlloc = item.allocations.find((a) => a.batchItemId === newItem.id);
    expect(oldAlloc?.quantity).toBe(3);
    expect(newAlloc?.quantity).toBe(1);

    const oldAvailable = await prisma.importBatchItem.findUnique({
      where: { id: oldItem.id },
    });
    const newAvailable = await prisma.importBatchItem.findUnique({
      where: { id: newItem.id },
    });
    expect(Number(oldAvailable?.quantityAvailable)).toBe(0);
    expect(Number(newAvailable?.quantityAvailable)).toBe(4);
  });

  test("RF-S21-02 - Bloquea venta si no hay stock por lote aunque ProductVariant.stock tenga unidades", async () => {
    const { user } = await getAdmin();
    const customer = await createTestCustomer("BLOCK01");
    const { variant, newItem } = await createTestProductWithBatches({
      suffix: "BLOCK01",
      oldBatch: { quantity: 0, unitCost: "30.0000" },
      newBatch: { quantity: 1, unitCost: "30.0000" },
    });
    // Agotamos el stock por lote (queda en 0) pero el stock global sigue
    // mostrando 1 unidad porque no se movió `ProductVariant.stock`.
    await prisma.importBatchItem.update({
      where: { id: newItem.id },
      data: { quantityAvailable: 0 },
    });

    await expect(
      createQuickSale({
        customerId: customer.id,
        items: [{ variantId: variant.id, quantity: 1 }],
        discount: "0",
        shippingAmount: "0",
        advanceAmount: "100",
        paymentMethod: "YAPE",
        actorId: user.id,
      }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_BATCH_STOCK" });
  });

  test("RF-S21-06 - Fallback legado para variante sin lote", async () => {
    const { user } = await getAdmin();
    const customer = await createTestCustomer("LEGACY01");
    const variant = await createTestProductWithStock("LEGACY01", 5);
    // Aseguramos que la variante no tenga ImportBatchItem (lo es por defecto).

    const order = await createQuickSale({
      customerId: customer.id,
      items: [{ variantId: variant.id, quantity: 2 }],
      discount: "0",
      shippingAmount: "0",
      advanceAmount: "100",
      paymentMethod: "YAPE",
      actorId: user.id,
    });

    const item = await prisma.orderItem.findFirst({
      where: { orderId: order.orderId },
      include: { allocations: true },
    });
    expect(item?.costSource).toBe("LEGACY");
    expect(Number(item?.unitCostPen.toString())).toBeCloseTo(40, 2);
    expect(item?.allocations).toHaveLength(0);
  });

  test("RF-S21-05 - Pago PAID congela utilidad y respeta costo histórico", async () => {
    const { user } = await getAdmin();
    const customer = await createTestCustomer("PROFIT01");
    const { variant, oldItem } = await createTestProductWithBatches({
      suffix: "PROFIT01",
      oldBatch: { quantity: 2, unitCost: "30.0000" },
      newBatch: { quantity: 0, unitCost: "50.0000" },
    });

    const order = await createQuickSale({
      customerId: customer.id,
      items: [{ variantId: variant.id, quantity: 1 }],
      discount: "0",
      shippingAmount: "0",
      advanceAmount: "100",
      paymentMethod: "YAPE",
      actorId: user.id,
    });
    await validatePayment({ paymentId: order.paymentId, actorId: user.id });

    const orderRow = await prisma.order.findUnique({
      where: { id: order.orderId },
    });
    expect(orderRow?.status).toBe("PAID");
    expect(Number(orderRow?.productCostPen.toString())).toBeCloseTo(30, 2);
    expect(Number(orderRow?.grossProfitPen.toString())).toBeCloseTo(70, 2);
    expect(orderRow?.profitCalculatedAt).not.toBeNull();

    // Recalcular el lote no debe alterar allocations ya persistidas.
    await recalculateBatchAction(oldItem.batchId);
    const allocations = await prisma.orderItemBatchAllocation.findMany({
      where: { batchItemId: oldItem.id },
    });
    const item = await prisma.orderItem.findFirst({
      where: { orderId: order.orderId },
    });
    expect(item?.totalCostPen.toString()).toBe("30.00");
    expect(allocations).toHaveLength(1);
  });

  test("RF-S21-05 - Cancelar reserva restaura quantityAvailable", async () => {
    const { user } = await getAdmin();
    const customer = await createTestCustomer("RELEASE01");
    const { variant, oldItem, newItem } = await createTestProductWithBatches({
      suffix: "RELEASE01",
      oldBatch: { quantity: 1, unitCost: "30.0000" },
      newBatch: { quantity: 2, unitCost: "50.0000" },
    });

    const order = await createQuickSale({
      customerId: customer.id,
      items: [{ variantId: variant.id, quantity: 2 }],
      discount: "0",
      shippingAmount: "0",
      advanceAmount: "100",
      paymentMethod: "YAPE",
      actorId: user.id,
    });

    const oldAfter = await prisma.importBatchItem.findUnique({
      where: { id: oldItem.id },
    });
    const newAfter = await prisma.importBatchItem.findUnique({
      where: { id: newItem.id },
    });
    expect(Number(oldAfter?.quantityAvailable)).toBe(0);
    expect(Number(newAfter?.quantityAvailable)).toBe(1);

    await prisma.order.update({
      where: { id: order.orderId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    await expireReservation({ orderId: order.orderId, expiredById: user.id });

    const oldReleased = await prisma.importBatchItem.findUnique({
      where: { id: oldItem.id },
    });
    const newReleased = await prisma.importBatchItem.findUnique({
      where: { id: newItem.id },
    });
    expect(Number(oldReleased?.quantityAvailable)).toBe(1);
    expect(Number(newReleased?.quantityAvailable)).toBe(2);

    const allocs = await prisma.orderItemBatchAllocation.count({
      where: {
        orderItem: { order: { customer: { name: { startsWith: "E2E-" } } } },
        batchItemId: { in: [oldItem.id, newItem.id] },
      },
    });
    expect(allocs).toBe(0);

    const releaseAudit = await prisma.auditLog.count({
      where: { action: "ORDER_BATCH_ALLOCATION_RELEASED" },
    });
    expect(releaseAudit).toBeGreaterThan(0);
  });

  test("RF-S21-04 - Profit reconocido audita ORDER_PROFIT_RECOGNIZED", async () => {
    const { user } = await getAdmin();
    const customer = await createTestCustomer("AUDIT01");
    const { variant } = await createTestProductWithBatches({
      suffix: "AUDIT01",
      oldBatch: { quantity: 1, unitCost: "25.0000" },
      newBatch: { quantity: 0, unitCost: "30.0000" },
    });

    const order = await createQuickSale({
      customerId: customer.id,
      items: [{ variantId: variant.id, quantity: 1 }],
      discount: "0",
      shippingAmount: "0",
      advanceAmount: "100",
      paymentMethod: "YAPE",
      actorId: user.id,
    });
    await validatePayment({ paymentId: order.paymentId, actorId: user.id });

    const audit = await prisma.auditLog.findFirst({
      where: { action: "ORDER_PROFIT_RECOGNIZED", entityId: order.orderId },
    });
    expect(audit).not.toBeNull();
    expect(Number(audit?.metadata?.grossProfitPen)).toBeCloseTo(75, 2);
  });

  test("RF-S21-01 - SalesChannel queda persistido en el pedido", async () => {
    const { user } = await getAdmin();
    const customer = await createTestCustomer("CH01");
    const variant = await createTestProductWithStock("CH01", 5);

    const order = await createQuickSale({
      customerId: customer.id,
      items: [{ variantId: variant.id, quantity: 1 }],
      discount: "0",
      shippingAmount: "0",
      advanceAmount: "100",
      paymentMethod: "YAPE",
      salesChannel: "TIKTOK_LIVE",
      actorId: user.id,
    });
    const row = await prisma.order.findUnique({ where: { id: order.orderId } });
    expect(row?.salesChannel).toBe("TIKTOK_LIVE");
  });
});

// Uso de OrderError sólo para evitar warning de import no usado.
void OrderError;
