import { test, expect, login, ADMIN, SELLER, DISPATCH } from "./fixtures/auth";

test.describe("Fase 5 — permisos y seguridad", () => {
  test("usuario no autenticado es redirigido a login con from", async ({ page }) => {
    await page.goto("/reportes");
    await expect(page).toHaveURL(/\/login\?from=%2Freportes/);
  });

  test("ADMIN puede abrir configuración y auditoría", async ({ adminPage }) => {
    await adminPage.goto("/configuracion");
    await expect(adminPage).toHaveURL(/\/configuracion(\?|$)/);

    await adminPage.goto("/auditoria");
    await expect(adminPage).toHaveURL(/\/auditoria(\?|$)/);
  });

  test("SELLER no puede abrir configuración, auditoría ni gastos", async ({ sellerPage }) => {
    await sellerPage.goto("/configuracion");
    await expect(sellerPage).toHaveURL(/\/dashboard(\?|$)/);

    await sellerPage.goto("/auditoria");
    await expect(sellerPage).toHaveURL(/\/dashboard(\?|$)/);

    await sellerPage.goto("/gastos");
    await expect(sellerPage).toHaveURL(/\/dashboard(\?|$)/);
  });

  test("DISPATCH puede abrir envíos pero no clientes, pagos ni reportes", async ({ dispatchPage }) => {
    await dispatchPage.goto("/envios");
    await expect(dispatchPage).toHaveURL(/\/envios(\?|$)/);

    await dispatchPage.goto("/clientes");
    await expect(dispatchPage).toHaveURL(/\/dashboard(\?|$)/);

    await dispatchPage.goto("/pagos");
    await expect(dispatchPage).toHaveURL(/\/dashboard(\?|$)/);

    await dispatchPage.goto("/reportes");
    await expect(dispatchPage).toHaveURL(/\/dashboard(\?|$)/);
  });

  test("flujo de login funciona para los 3 roles seeded", async ({ browser }) => {
    for (const credentials of [ADMIN, SELLER, DISPATCH]) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await login(page, credentials);
      await expect(page).toHaveURL(/\/dashboard(\?|$)/);
      await context.close();
    }
  });
});
