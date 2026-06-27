// Cargador de .env simple para scripts que no usan pnpm/Next.js.
// Lee pares `KEY="VALUE"` y los exporta a process.env.

import * as fs from "node:fs";
import * as path from "node:path";

const files = [".env.local", ".env"];

for (const file of files) {
  const p = path.resolve(process.cwd(), file);
  if (!fs.existsSync(p)) continue;
  const content = fs.readFileSync(p, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}
