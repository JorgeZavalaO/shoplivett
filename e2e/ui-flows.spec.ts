// Flujos UI reales de Fase 4. Cubre formularios y acciones de servidor que
// las pruebas de dominio no pueden detectar (wiring, navegación, permisos).

import { test, expect, login, ADMIN, SELLER, DISPATCH } from "./fixtures/auth";
import { prisma, getAdmin, createTestCustomer, createTestProductWithStock, cleanupTestData } from "./fixtures/db";
import { createQuickSale } from "../lib/sales";

test.afterAll(async () => {
  await cleanupTestData();
  await prisma.$disconnect();
});

test.describe("Fase 4 — UI real: pagos y envíos", () => {
  test("Vendedor registra pago; admin lo valida vía UI", async ({ browser }) => {
    const { user: admin } = await getAdmin();
    const customer = await createTestCustomer("UI01");
    const variant = await createTestProductWithStock("UI01", 5);
    const order = await createQuickSale({
      customerId: customer.id,
      items: [{ variantId: variant.id, quantity: 1 }],
      discount: "0",
      shippingAmount: "0",
      advanceAmount: "60",
      paymentMethod: "YAPE",
      actorId: admin.id,
    });

    const sellerCtx = await browser.newContext();
    const sellerPage = await sellerCtx.newPage();
    await login(sellerPage, SELLER);
    await sellerPage.goto(`/pagos/${order.paymentId}`);
    await expect(
      sellerPage.getByRole("heading", { name: /Pago/i }),
    ).toBeVisible();

    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await login(adminPage, ADMIN);
    await adminPage.goto(`/pagos/${order.paymentId}`);
    await adminPage.getByRole("button", { name: /Confirmar validación/i }).click();
    await adminPage.getByRole("button", { name: /Validar pago$/i }).click();

    await expect(
      adminPage.getByText(/Pago validado\./i),
    ).toBeVisible({ timeout: 15_000 });

    const refreshed = await prisma.payment.findUnique({
      where: { id: order.paymentId },
    });
    expect(refreshed?.status).toBe("VALIDATED");

    const validatedOrder = await prisma.order.findUnique({
      where: { id: order.orderId },
    });
    expect(validatedOrder?.status).toBe("PARTIALLY_PAID");

    await sellerCtx.close();
    await adminCtx.close();
  });

  test("Despacho cancela envío con motivo desde UI y queda atómico", async ({ browser }) => {
    const { user: admin } = await getAdmin();
    const customer = await createTestCustomer("UI02");
    const variant = await createTestProductWithStock("UI02", 5);
    const order = await createQuickSale({
      customerId: customer.id,
      items: [{ variantId: variant.id, quantity: 1 }],
      discount: "0",
      shippingAmount: "0",
      advanceAmount: "100",
      paymentMethod: "YAPE",
      actorId: admin.id,
    });
    await prisma.payment.update({
      where: { id: order.paymentId },
      data: { status: "VALIDATED", validatedAt: new Date(), validatedById: admin.id },
    });
    await prisma.order.update({
      where: { id: order.orderId },
      data: {
        status: "PAID",
        validatedPaid: "100.00",
        balance: "0.00",
        reservedStock: { decrement: 1 },
        soldStock: { increment: 1 },
      },
    });
    const shipment = await prisma.shipment.create({
      data: {
        customerId: customer.id,
        status: "PENDING",
        shippingMethod: "DELIVERY_PROPIO",
        shippingCost: "0.00",
        isFreeShipping: true,
        createdById: admin.id,
        orders: { create: [{ orderId: order.orderId }] },
      },
    });

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await login(page, DISPATCH);
    await page.goto(`/envios/${shipment.id}`);
    await expect(
      page.getByRole("heading", { name: /Envío/i }),
    ).toBeVisible();

    await page.getByRole("button", { name: /Cancelar envío/i }).first().click();
    await page.getByLabel(/Motivo/i).fill("Cliente canceló antes de despacho");
    await page.getByRole("button", { name: /Continuar/i }).click();
    await page.getByRole("button", { name: /Sí, cancelar envío/i }).click();

    await expect(page.getByText(/Envío cancelado\./i)).toBeVisible({
      timeout: 15_000,
    });

    const finalShipment = await prisma.shipment.findUnique({
      where: { id: shipment.id },
    });
    expect(finalShipment?.status).toBe("CANCELLED");
    expect(finalShipment?.notes).toBe("Cliente canceló antes de despacho");
    expect(finalShipment?.cancelledAt).not.toBeNull();

    await ctx.close();
  });
});
