import { test as base, expect, type Page } from "@playwright/test";

export type Credentials = {
  email: string;
  password: string;
};

export const ADMIN: Credentials = {
  email: "admin@shoplivett.local",
  password: process.env.SEED_ADMIN_PASSWORD ?? "admin-shoplivett",
};

export const SELLER: Credentials = {
  email: "seller@shoplivett.local",
  password: process.env.SEED_SELLER_PASSWORD ?? "seller-shoplivett",
};

export const DISPATCH: Credentials = {
  email: "dispatch@shoplivett.local",
  password: process.env.SEED_DISPATCH_PASSWORD ?? "dispatch-shoplivett",
};

export async function login(page: Page, credentials: Credentials) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(credentials.email);
  await page.getByLabel("Contraseña").fill(credentials.password);
  await page.getByRole("button", { name: /ingresar/i }).click();
  await page.waitForURL(/\/dashboard(\?|$)/, { timeout: 15_000 });
}

export async function logout(page: Page) {
  await page.context().clearCookies();
}

export const test = base.extend<{
  adminPage: Page;
  sellerPage: Page;
}>({
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, ADMIN);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
    await context.close();
  },
  sellerPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, SELLER);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
    await context.close();
  },
});

export { expect };
