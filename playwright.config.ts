import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3100;
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

// El arranque E2E debe ser cross-platform. En CI construimos y arrancamos en
// modo producción; en local podemos iterar más rápido con `next dev`. La
// elección se controla con E2E_START_MODE (build|dev). Por defecto: build.
const E2E_START_MODE = process.env.E2E_START_MODE ?? "build";

const localCommand = (() => {
  if (process.env.E2E_BASE_URL) return undefined;
  const envPrefix = process.env.E2E_ENV_FILE
    ? `dotenv -e ${process.env.E2E_ENV_FILE} -- `
    : "";
  if (E2E_START_MODE === "dev") {
    return `${envPrefix}cross-env PORT=${PORT} pnpm dev`;
  }
  return `${envPrefix}pnpm build && ${envPrefix}cross-env PORT=${PORT} pnpm start`;
})();

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI
    ? [["list"], ["github"]]
    : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    headless: true,
    locale: "es-PE",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: localCommand
    ? {
        command: localCommand,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      }
    : undefined,
});
