import { test, expect } from "./fixtures/auth";
import { cleanupCustomersByPrefix, prisma } from "./fixtures/db";

const SMOKE_PREFIX = "E2E-SMOKE";

test.afterAll(async () => {
  await cleanupCustomersByPrefix(SMOKE_PREFIX);
  await prisma.$disconnect();
});

test.describe("Sprint 15 — Smoke E2E (críticos)", () => {
  test("login, dashboard y navegación básica", async ({ adminPage }) => {
    await expect(adminPage.getByRole("heading", { level: 1 })).toBeVisible();
    await adminPage.getByRole("link", { name: /clientes/i }).first().click();
    await expect(adminPage).toHaveURL(/\/clientes(\?|$)/);
  });

  test("crear cliente con WhatsApp nuevo y buscarlo", async ({ adminPage }) => {
    const stamp = Date.now();
    const uniquePhone = `+5199${String(stamp).slice(-7)}`;
    const customerName = `${SMOKE_PREFIX} Cliente ${stamp}`;

    await adminPage.goto("/clientes/nuevo");
    await adminPage.getByLabel("Nombre").fill(customerName);
    await adminPage.getByLabel("WhatsApp").fill(uniquePhone);
    await adminPage.getByRole("button", { name: /guardar|crear/i }).click();

    await expect(adminPage).toHaveURL(/\/clientes\/[^/]+$/, { timeout: 15_000 });

    await adminPage.goto("/clientes");
    await adminPage.getByPlaceholder(/buscar/i).fill(customerName);
    await adminPage.getByRole("button", { name: /buscar/i }).click();
    await expect(
      adminPage.getByText(customerName).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
