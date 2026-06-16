// Pruebas de concurrencia obligatorias para la Fase 3A.
// Verifica que las operaciones críticas que pasaron a Serializable:
//  - validan correctamente el conflicto de concurrencia
//  - nunca dejan estados parciales
//  - mantienen un único evento de auditoría por acción financiera

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
  rejectPayment,
  setPaymentApplications,
  validatePayment,
} from "../lib/payments";
import { createShipment, cancelShipment, changeShipmentStatus } from "../lib/shipments";

test.afterAll(async () => {
  await cleanupTestData();
  await prisma.$disconnect();
});

test.describe("Fase 3A — Concurrencia e integridad", () => {
  test("Doble validación concurrente del mismo pago deja una sola transición", async () => {
    const { user } = await getAdmin();
    const customer = await createTestCustomer("CC01");
    const variant = await createTestProductWithStock("CC01", 5);

    const order = await createQuickSale({
      customerId: customer.id,
      items: [{ variantId: variant.id, quantity: 1 }],
      discount: "0",
      shippingAmount: "0",
      advanceAmount: "100",
      paymentMethod: "YAPE",
      actorId: user.id,
    });

    const results = await Promise.allSettled([
      validatePayment({ paymentId: order.paymentId, actorId: user.id }),
      validatePayment({ paymentId: order.paymentId, actorId: user.id }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const paymentRow = await prisma.payment.findUnique({
      where: { id: order.paymentId },
    });
    expect(paymentRow?.status).toBe("VALIDATED");

    const auditCount = await prisma.auditLog.count({
      where: { entity: "Payment", entityId: order.paymentId, action: "PAYMENT_VALIDATED" },
    });
    expect(auditCount).toBe(1);
  });

  test("Editar aplicaciones y rechazar el mismo pago no genera estado mixto", async () => {
    const { user } = await getAdmin();
    const customer = await createTestCustomer("CC02");
    const variant = await createTestProductWithStock("CC02", 5);

    const order = await createQuickSale({
      customerId: customer.id,
      items: [{ variantId: variant.id, quantity: 1 }],
      discount: "0",
      shippingAmount: "0",
      advanceAmount: "60",
      paymentMethod: "YAPE",
      actorId: user.id,
    });

    const standalone = await createPayment({
      customerId: customer.id,
      method: "PLIN",
      amount: "60",
      applications: [{ orderId: order.orderId, amount: "60" }],
    });

    const [editResult, rejectResult] = await Promise.allSettled([
      setPaymentApplications(standalone.paymentId, [], { actorId: user.id }),
      rejectPayment({
        paymentId: standalone.paymentId,
        reason: "Operación cruzada",
        actorId: user.id,
      }),
    ]);

    const allRejected = editResult.status === "rejected" || rejectResult.status === "rejected";
    expect(allRejected).toBe(true);

    const finalPayment = await prisma.payment.findUnique({
      where: { id: standalone.paymentId },
    });
    expect(["PENDING", "REJECTED"]).toContain(finalPayment?.status);

    const remainingApps = await prisma.paymentApplication.count({
      where: { paymentId: standalone.paymentId },
    });
    expect(remainingApps).toBeLessThanOrEqual(1);
  });

  test("Cancelación de envío con motivo persiste atómicamente", async () => {
    const { user } = await getAdmin();
    const customer = await createTestCustomer("CC03");
    const variant = await createTestProductWithStock("CC03", 5);

    const a = await createQuickSale({
      customerId: customer.id,
      items: [{ variantId: variant.id, quantity: 1 }],
      discount: "0",
      shippingAmount: "0",
      advanceAmount: "100",
      paymentMethod: "YAPE",
      actorId: user.id,
    });
    await validatePayment({ paymentId: a.paymentId, actorId: user.id });

    const shipment = await createShipment({
      customerId: customer.id,
      orderIds: [a.orderId],
      shippingMethod: "DELIVERY_PROPIO",
      shippingCost: "0",
      forceFreeShipping: true,
      agencyName: null,
      trackingCode: null,
      addressSnapshot: null,
      districtSnapshot: null,
      referenceSnapshot: null,
      notes: null,
      actorId: user.id,
    });

    await cancelShipment({
      shipmentId: shipment.shipmentId,
      reason: "Cliente canceló antes de despacho",
      actorId: user.id,
    });

    const finalShipment = await prisma.shipment.findUnique({
      where: { id: shipment.shipmentId },
    });
    expect(finalShipment?.status).toBe("CANCELLED");
    expect(finalShipment?.notes).toBe("Cliente canceló antes de despacho");
    expect(finalShipment?.cancelledAt).not.toBeNull();
  });

  test("Dos cambios de estado concurrentes sólo dejan una transición", async () => {
    const { user } = await getAdmin();
    const customer = await createTestCustomer("CC04");
    const variant = await createTestProductWithStock("CC04", 5);

    const a = await createQuickSale({
      customerId: customer.id,
      items: [{ variantId: variant.id, quantity: 1 }],
      discount: "0",
      shippingAmount: "0",
      advanceAmount: "100",
      paymentMethod: "YAPE",
      actorId: user.id,
    });
    await validatePayment({ paymentId: a.paymentId, actorId: user.id });

    const shipment = await createShipment({
      customerId: customer.id,
      orderIds: [a.orderId],
      shippingMethod: "DELIVERY_PROPIO",
      shippingCost: "0",
      forceFreeShipping: true,
      agencyName: null,
      trackingCode: null,
      addressSnapshot: null,
      districtSnapshot: null,
      referenceSnapshot: null,
      notes: null,
      actorId: user.id,
    });

    const results = await Promise.allSettled([
      changeShipmentStatus({ shipmentId: shipment.shipmentId, to: "PREPARING", actorId: user.id }),
      changeShipmentStatus({ shipmentId: shipment.shipmentId, to: "CANCELLED", actorId: user.id }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const final = await prisma.shipment.findUnique({ where: { id: shipment.shipmentId } });
    expect(["PREPARING", "CANCELLED"]).toContain(final?.status);
  });
});
