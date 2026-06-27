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
const result = spawnSync(process.execPath, ["--import", "tsx", target, ...rest], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
