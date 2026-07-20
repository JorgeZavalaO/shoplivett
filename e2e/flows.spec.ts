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
import { cancelShipment, createShipment } from "../lib/shipments";
import { expireReservation } from "../lib/order-expiry";
import { coercePaymentMethodFees } from "../lib/settings-defaults";

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

  test("AUD-DATA-001 — Validar pago completo incluye comisión del pago actual en utilidad", async () => {
    const { user } = await getAdmin();
    const customer = await createTestCustomer("AUD001");
    const variant = await createTestProductWithStock("AUD001", 5);
    const settings = await prisma.businessSettings.findUnique({ where: { id: "default" } });
    const previousFees = coercePaymentMethodFees(settings?.paymentMethodFees);
    const previousPackaging = settings?.standardPackagingCostPen?.toString() ?? "2.00";

    try {
      await prisma.businessSettings.update({
        where: { id: "default" },
        data: {
          paymentMethodFees: { YAPE: 300, PLIN: 0, CASH: 0, OTHER: 0 },
          standardPackagingCostPen: "2.00",
        },
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

      const paidOrder = await prisma.order.findUnique({ where: { id: order.orderId } });
      expect(paidOrder?.status).toBe("PAID");
      expect(Number(paidOrder?.grossProfitPen.toString())).toBeCloseTo(60, 2);
      expect(Number(paidOrder?.paymentFeePen.toString())).toBeCloseTo(3, 2);
      expect(Number(paidOrder?.packagingCostPen.toString())).toBeCloseTo(2, 2);
      expect(Number(paidOrder?.netProfitPen.toString())).toBeCloseTo(55, 2);
    } finally {
      await prisma.businessSettings.update({
        where: { id: "default" },
        data: {
          paymentMethodFees: previousFees,
          standardPackagingCostPen: previousPackaging,
        },
      });
    }
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

  test("AUD-DATA-008 — pedido con envío cancelado puede reenviarse", async () => {
    const { user } = await getAdmin();
    const customer = await createTestCustomer("05b");
    const variant = await createTestProductWithStock("05b", 3);

    const sale = await createQuickSale({
      customerId: customer.id,
      items: [{ variantId: variant.id, quantity: 1 }],
      discount: "0",
      shippingAmount: "0",
      advanceAmount: "100",
      paymentMethod: "YAPE",
      actorId: user.id,
    });
    await validatePayment({ paymentId: sale.paymentId, actorId: user.id });

    const first = await createShipment({
      customerId: customer.id,
      orderIds: [sale.orderId],
      shippingMethod: "DELIVERY_PROPIO",
      shippingCost: "10",
      forceFreeShipping: false,
      actorId: user.id,
    });
    await cancelShipment({
      shipmentId: first.shipmentId,
      reason: "Reprogramación de despacho",
      actorId: user.id,
    });

    const second = await createShipment({
      customerId: customer.id,
      orderIds: [sale.orderId],
      shippingMethod: "DELIVERY_PROPIO",
      shippingCost: "10",
      forceFreeShipping: false,
      actorId: user.id,
    });

    const links = await prisma.shipmentOrder.findMany({
      where: { orderId: sale.orderId },
      include: { shipment: { select: { id: true, status: true } } },
      orderBy: { createdAt: "asc" },
    });
    expect(links).toHaveLength(2);
    expect(links[0].shipment.status).toBe("CANCELLED");
    expect(links[1].shipment.id).toBe(second.shipmentId);
    expect(links.filter((l) => l.shipment.status !== "CANCELLED")).toHaveLength(1);
  });

  test("RF-S15-07 — Rechazo de pago: libera stock y cancela reserva sin pagos validados", async () => {
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

    const reserved = await prisma.productVariant.findUnique({
      where: { id: variant.id },
    });
    expect(Number(reserved?.reservedStock)).toBe(1);

    const payment = await createPayment({
      customerId: customer.id,
      method: "YAPE",
      amount: "60",
      applications: [{ orderId: order.orderId, amount: "60" }],
    });
    const result = await rejectPayment({
      paymentId: payment.paymentId,
      reason: "Captura ilegible",
      actorId: user.id,
    });

    const rejected = await prisma.payment.findUnique({
      where: { id: payment.paymentId },
    });
    expect(rejected?.status).toBe("REJECTED");
    const cancelledOrder = await prisma.order.findUnique({
      where: { id: order.orderId },
    });
    expect(cancelledOrder?.status).toBe("CANCELLED");
    expect(Number(cancelledOrder?.balance)).toBe(0);
    expect(result.cancelledOrders).toHaveLength(1);
    expect(result.cancelledOrders[0]?.orderId).toBe(order.orderId);

    const after = await prisma.productVariant.findUnique({
      where: { id: variant.id },
    });
    expect(Number(after?.reservedStock)).toBe(0);
    expect(Number(after?.stock)).toBe(Number(reserved?.stock));
  });

  test("RF-S15-09 — Rechazo de pago: pedido con otro pago pendiente no se cancela", async () => {
    const { user } = await getAdmin();
    const customer = await createTestCustomer("09");
    const variant = await createTestProductWithStock("09", 5);

    const order = await createQuickSale({
      customerId: customer.id,
      items: [{ variantId: variant.id, quantity: 1 }],
      discount: "0",
      shippingAmount: "0",
      advanceAmount: "50",
      paymentMethod: "YAPE",
      actorId: user.id,
    });

    const secondPayment = await createPayment({
      customerId: customer.id,
      method: "YAPE",
      amount: "20",
      applications: [{ orderId: order.orderId, amount: "20" }],
    });

    const result = await rejectPayment({
      paymentId: order.paymentId,
      reason: "Captura ilegible",
      actorId: user.id,
    });

    expect(result.cancelledOrders).toHaveLength(0);
    const untouched = await prisma.order.findUnique({
      where: { id: order.orderId },
    });
    expect(untouched?.status).toBe("PAYMENT_VALIDATION_PENDING");
    const reserved = await prisma.productVariant.findUnique({
      where: { id: variant.id },
    });
    expect(Number(reserved?.reservedStock)).toBe(1);

    const secondRow = await prisma.payment.findUnique({
      where: { id: secondPayment.paymentId },
    });
    expect(secondRow?.status).toBe("PENDING");
  });

  test("RF-S15-10 — Rechazo de pago: pedido parcialmente pagado no se cancela", async () => {
    const { user } = await getAdmin();
    const customer = await createTestCustomer("10");
    const variant = await createTestProductWithStock("10", 5);

    const order = await createQuickSale({
      customerId: customer.id,
      items: [{ variantId: variant.id, quantity: 1 }],
      discount: "0",
      shippingAmount: "0",
      advanceAmount: "50",
      paymentMethod: "YAPE",
      actorId: user.id,
    });

    await validatePayment({ paymentId: order.paymentId, actorId: user.id });

    const partial = await createPayment({
      customerId: customer.id,
      method: "YAPE",
      amount: "20",
      applications: [{ orderId: order.orderId, amount: "20" }],
    });

    const result = await rejectPayment({
      paymentId: partial.paymentId,
      reason: "Pago duplicado",
      actorId: user.id,
    });

    expect(result.cancelledOrders).toHaveLength(0);
    const orderRow = await prisma.order.findUnique({
      where: { id: order.orderId },
    });
    expect(orderRow?.status).toBe("PARTIALLY_PAID");
    const reserved = await prisma.productVariant.findUnique({
      where: { id: variant.id },
    });
    expect(Number(reserved?.reservedStock)).toBe(1);
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

  test("Crear producto sin precio, crear lote, recalcular vía BD y aplicar precio sugerido desde UI", async ({ adminPage }) => {
    const stamp = Date.now();
    const prefix = `PRICE-${stamp}`;

    // Setup: categoría y producto sin precio
    await prisma.category.upsert({
      where: { slug: "e2e-precio" },
      update: {},
      create: { name: "E2E Precio", slug: "e2e-precio", isActive: true },
    });

    const product = await prisma.product.create({
      data: { name: `${prefix} Producto`, isActive: true, categoryId: (await prisma.category.findUnique({ where: { slug: "e2e-precio" } }))!.id },
    });

    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        code: `${prefix}-VAR`,
        price: "0.00",
        cost: "30.00",
        stock: 10,
        reservedStock: 0,
        soldStock: 0,
        status: "ACTIVE",
      },
    });

    await prisma.inventoryMovement.create({
      data: { variantId: variant.id, type: "IN", quantity: 10, reason: "E2E seed" },
    });

    // Setup: lote de importación con costos ya calculados
    const batch = await prisma.importBatch.create({
      data: {
        code: `${prefix}-LOTE`,
        purchaseDate: new Date(),
        shopper: "E2E shopper",
        agency: "E2E agency",
        totalCostUsd: "400.00",
        totalAdditionalCostsUsd: "10.00",
        totalAdditionalCostsPen: "5.00",
        exchangeRate: "3.7500",
        totalInvestmentPen: "1542.50",
        status: "COMPLETE",
        distributionMethod: "MIXED",
        lastRecalculatedAt: new Date(),
      },
    });

    await prisma.importBatchItem.create({
      data: {
        batchId: batch.id,
        variantId: variant.id,
        quantityPurchased: 10,
        quantityReceived: 10,
        quantityAvailable: 10,
        unitCostUsd: "40.0000",
        unitCostPen: "150.0000",
        weight: "0",
        subtotalUsd: "400.00",
        subtotalPen: "1500.00",
        additionalCostPen: "4.2500",
        additionalSubtotalPen: "42.50",
        landedUnitCostPen: "154.2500",
        landedSubtotalPen: "1542.50",
        calculatedAt: new Date(),
      },
    });

    // Navegar al detalle del lote
    await adminPage.goto(`/lotes/${batch.id}`);
    await expect(adminPage.getByText(prefix)).toBeVisible({ timeout: 15_000 });

    // Verificar que aparece "Sin precio"
    await expect(adminPage.getByText("Sin precio")).toBeVisible();

    // Verificar que aparece el banner de productos sin precio
    await expect(adminPage.getByText("Productos sin precio de venta")).toBeVisible();

    // Verificar que hay un botón Aplicar con el precio sugerido
    const applyButton = adminPage.locator("button").filter({ hasText: /S\/\s+\d+\.\d{2}/ }).first();
    await expect(applyButton).toBeVisible();

    // Click en Aplicar
    await applyButton.click();

    // Esperar el toast de éxito
    await expect(adminPage.getByText("Precio aplicado")).toBeVisible({ timeout: 15_000 });

    // Verificar que la variante ahora tiene precio
    const updatedVariant = await prisma.productVariant.findUnique({ where: { id: variant.id } });
    expect(Number(updatedVariant?.price)).toBeGreaterThan(0);

    // Recargar la página y verificar que ya no dice "Sin precio"
    await adminPage.reload();
    await expect(adminPage.getByText("Sin precio")).not.toBeVisible();
  });
});
