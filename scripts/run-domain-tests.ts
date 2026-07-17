import { spawnSync } from "node:child_process";

const TEST_SCRIPTS = [
  "scripts/test-auth-rate-limit.ts",
  "scripts/test-permissions.ts",
  "scripts/test-upload-validation.ts",
  "scripts/test-order-batch-fifo.ts",
  "scripts/test-payment-reservation-closure.ts",
  "scripts/test-customer-blocked-sale.ts",
  "scripts/test-db-constraints.ts",
  "scripts/test-batch-closed-race.ts",
  "scripts/test-expenses.ts",
  "scripts/test-incidents.ts",
  "scripts/test-financial-dashboard.ts",
  "scripts/test-financial-reports.ts",
  "scripts/test-perf-fixes.ts",
  "scripts/test-reports.ts",
  "scripts/test-shipment-real-cost.ts",
];

for (const script of TEST_SCRIPTS) {
  console.log(`\n==> ${script}`);
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/_with-env.ts", script],
    {
      stdio: "inherit",
      env: process.env,
    },
  );

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("\nTodos los tests de dominio pasaron.");
