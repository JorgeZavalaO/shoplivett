// Cargador puntual de .env antes de ejecutar un test de dominio.
// Uso: pnpm tsx scripts/_with-env.ts scripts/test-expenses.ts
import { config } from "dotenv";
import { spawnSync } from "node:child_process";

config({ path: ".env" });

const target = process.argv[2];
if (!target) {
  console.error("Uso: tsx scripts/_with-env.ts <script>");
  process.exit(1);
}

const rest = process.argv.slice(3);
// Tests de performance necesitan log de queries Prisma para contar el
// numero exacto de sentencias que ejecuta cada dominio.
if (target.includes("test-perf")) {
  process.env.PRISMA_LOG_QUERY = "1";
}

const result = spawnSync(process.execPath, ["--import", "tsx", target, ...rest], {
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);
