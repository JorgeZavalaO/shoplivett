import { test, expect } from "./fixtures/auth";
import {
  cleanupTestData,
  createTestCustomer,
  createTestProductWithStock,
  getAdmin,
  prisma,
} from "./fixtures/db";
import { createQuickSale } from "../lib/sales";
import {
  createPayment,
  validatePayment,
  rejectPayment,
} from "../lib/payments";
import { createShipment } from "../lib/shipments";
import { expireReservation } from "../lib/order-expiry";

test.afterAll(async () => {
  await cleanupTestData();
  await prisma.$disconnect();
});

test.describe("Sprint 15 — Flujos obligatorios", () => {
  test("RF-S15-01 / RF-S15-02 — Venta con adelanto y validación posterior + venta pagada completa", async () => {
    const { user } = await getAdmin();
    const customer = await createTestCustomer("01");
    const variant = await createTestProductWithStock("01", 5);

    const order = await createQuickSale({
      customerId: customer.id,
      items: [{ variantId: variant.id, quantity: 1 }],
      discount: "0",
      shippingAmount: "0",
      advanceAmount: "60",
      paymentMethod: "YAPE",
      actorId: user.id,
    });

    const orderRow = await prisma.order.findUnique({
      where: { id: order.orderId },
      include: { items: true },
    });
    expect(orderRow?.status).toBe("PAYMENT_VALIDATION_PENDING");
    const reserved = await prisma.productVariant.findUnique({
      where: { id: variant.id },
    });
    expect(Number(reserved?.reservedStock)).toBe(1);

    const paymentId = order.paymentId;
    await validatePayment({ paymentId, actorId: user.id });

    const after = await prisma.order.findUnique({
      where: { id: order.orderId },
    });
    expect(after?.status).toBe("PARTIALLY_PAID");

    const customer2 = await createTestCustomer("01b");
    const variant2 = await createTestProductWithStock("01b", 5);
    const order2 = await createQuickSale({
      customerId: customer2.id,
      items: [{ variantId: variant2.id, quantity: 1 }],
      discount: "0",
      shippingAmount: "0",
      advanceAmount: "100",
      paymentMethod: "YAPE",
      actorId: user.id,
    });
    await validatePayment({ paymentId: order2.paymentId, actorId: user.id });

    const paidOrder = await prisma.order.findUnique({
      where: { id: order2.orderId },
    });
    expect(paidOrder?.status).toBe("PAID");
    const sold = await prisma.productVariant.findUnique({
      where: { id: variant2.id },
    });
    expect(Number(sold?.soldStock)).toBe(1);
  });

  test("RF-S15-03 — Pago aplicado a varios pedidos", async () => {
    const { user } = await getAdmin();
    const customer = await createTestCustomer("02");
    const variant = await createTestProductWithStock("02", 10);

    const a = await createQuickSale({
      customerId: customer.id,
      items: [{ variantId: variant.id, quantity: 1 }],
      discount: "0",
      shippingAmount: "0",
      advanceAmount: "50",
      paymentMethod: "YAPE",
      actorId: user.id,
    });
    const b = await createQuickSale({
      customerId: customer.id,
      items: [{ variantId: variant.id, quantity: 1 }],
      discount: "0",
      shippingAmount: "0",
      advanceAmount: "50",
      paymentMethod: "PLIN",
      actorId: user.id,
    });

    const payment = await createPayment({
      customerId: customer.id,
      method: "YAPE",
      amount: "100",
      applications: [
        { orderId: a.orderId, amount: "50" },
        { orderId: b.orderId, amount: "50" },
      ],
    });
    await validatePayment({ paymentId: payment.paymentId, actorId: user.id });

    const [orderA, orderB] = await Promise.all([
      prisma.order.findUnique({ where: { id: a.orderId } }),
      prisma.order.findUnique({ where: { id: b.orderId } }),
    ]);
    expect(orderA?.status).toBe("RESERVED");
    expect(orderB?.status).toBe("RESERVED");
  });

  test("RF-S15-04 — Sobrepago convertido en crédito", async () => {
    const { user } = await getAdmin();
    const customer = await createTestCustomer("03");
    const variant = await createTestProductWithStock("03", 5);

    const order = await createQuickSale({
      customerId: customer.id,
      items: [{ variantId: variant.id, quantity: 1 }],
      discount: "0",
      shippingAmount: "0",
      advanceAmount: "60",
      paymentMethod: "YAPE",
      actorId: user.id,
    });

    const payment = await createPayment({
      customerId: customer.id,
      method: "YAPE",
      amount: "100",
      applications: [{ orderId: order.orderId, amount: "60" }],
    });
    const result = await validatePayment({
      paymentId: payment.paymentId,
      excessTreatment: "CREDIT",
      actorId: user.id,
    });

    expect(result.excessCents).toBe(4000);
    const credit = await prisma.customerCredit.findFirst({
      where: { customerId: customer.id, origin: "OVERPAYMENT" },
    });
    expect(credit).not.toBeNull();
    expect(Number(credit?.amount)).toBe(40);
  });

  test("RF-S15-05 — Reserva vencida cancelada libera stock", async () => {
    const { user } = await getAdmin();
    const customer = await createTestCustomer("04");
    const variant = await createTestProductWithStock("04", 5);

    const order = await createQuickSale({
      customerId: customer.id,
      items: [{ variantId: variant.id, quantity: 1 }],
      discount: "0",
      shippingAmount: "0",
      advanceAmount: "60",
      paymentMethod: "YAPE",
      actorId: user.id,
    });
    await prisma.order.update({
      where: { id: order.orderId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    await expireReservation({ orderId: order.orderId, expiredById: user.id });

    const cancelled = await prisma.order.findUnique({
      where: { id: order.orderId },
    });
    expect(cancelled?.status).toBe("EXPIRED");
    const released = await prisma.productVariant.findUnique({
      where: { id: variant.id },
    });
    expect(Number(released?.reservedStock)).toBe(0);
  });

  test("RF-S15-06 — Envío agrupado de varios pedidos", async () => {
    const { user } = await getAdmin();
    const customer = await createTestCustomer("05");
    const variant = await createTestProductWithStock("05", 10);

    const a = await createQuickSale({
      customerId: customer.id,
      items: [{ variantId: variant.id, quantity: 1 }],
      discount: "0",
      shippingAmount: "0",
      advanceAmount: "100",
      paymentMethod: "YAPE",
      actorId: user.id,
    });
    const b = await createQuickSale({
      customerId: customer.id,
      items: [{ variantId: variant.id, quantity: 1 }],
      discount: "0",
      shippingAmount: "0",
      advanceAmount: "100",
      paymentMethod: "YAPE",
      actorId: user.id,
    });
    await validatePayment({ paymentId: a.paymentId, actorId: user.id });
    await validatePayment({ paymentId: b.paymentId, actorId: user.id });

    const shipment = await createShipment({
      customerId: customer.id,
      orderIds: [a.orderId, b.orderId],
      shippingMethod: "DELIVERY_PROPIO",
      shippingCost: "10",
      forceFreeShipping: false,
      agencyName: null,
      trackingCode: null,
      addressSnapshot: null,
      districtSnapshot: null,
      referenceSnapshot: null,
      notes: null,
      actorId: user.id,
    });

    const shipmentRow = await prisma.shipment.findUnique({
      where: { id: shipment.shipmentId },
      include: { orders: { include: { order: true } } },
    });
    expect(shipmentRow?.orders).toHaveLength(2);
    expect(
      shipmentRow?.orders.every((so: { order: { status: string } }) => so.order.status === "PAID"),
    ).toBe(true);
  });

  test("RF-S15-07 — Rechazo de pago no afecta saldos", async () => {
    const { user } = await getAdmin();
    const customer = await createTestCustomer("06");
    const variant = await createTestProductWithStock("06", 5);

    const order = await createQuickSale({
      customerId: customer.id,
      items: [{ variantId: variant.id, quantity: 1 }],
      discount: "0",
      shippingAmount: "0",
      advanceAmount: "60",
      paymentMethod: "YAPE",
      actorId: user.id,
    });

    const payment = await createPayment({
      customerId: customer.id,
      method: "YAPE",
      amount: "60",
      applications: [{ orderId: order.orderId, amount: "60" }],
    });
    await rejectPayment({
      paymentId: payment.paymentId,
      reason: "Captura ilegible",
      actorId: user.id,
    });

    const rejected = await prisma.payment.findUnique({
      where: { id: payment.paymentId },
    });
    expect(rejected?.status).toBe("REJECTED");
    const untouched = await prisma.order.findUnique({
      where: { id: order.orderId },
    });
    expect(untouched?.status).toBe("PAYMENT_VALIDATION_PENDING");
  });

  test("RF-S15-08 — Ajuste manual de stock", async () => {
    const variant = await createTestProductWithStock("07", 5);
    const { adjustStock } = await import("../lib/inventory");
    await adjustStock(variant.id, 7, "Ingreso E2E");
    const after = await prisma.productVariant.findUnique({
      where: { id: variant.id },
    });
    expect(Number(after?.stock)).toBe(12);
  });
});
