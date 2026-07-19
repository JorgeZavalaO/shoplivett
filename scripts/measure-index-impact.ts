// Script para medir el impacto de índices con EXPLAIN ANALYZE.
//
// Uso:
//   npx tsx scripts/measure-index-impact.ts
//
// Requiere conexión a BD (DATABASE_URL en .env).
// Ejecuta EXPLAIN ANALYZE sobre las queries más críticas y reporta
// tiempos de planificación y ejecución.

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "..", ".env") });

const prisma = new PrismaClient();

type QueryTiming = {
  description: string;
  planningTime: number;
  executionTime: number;
  totalTime: number;
  rows: number;
  indexUsed: boolean;
};

async function explain(
  description: string,
  q: string,
): Promise<QueryTiming> {
  const raw = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `EXPLAIN (ANALYZE, TIMING, BUFFERS) ${q}`,
  );

  const lines = raw.map((r) => String(Object.values(r)[0] ?? ""));
  const summary = lines[lines.length - 1] ?? "";

  const planningMatch = summary.match(/Planning Time:\s*([\d.]+)\s*ms/);
  const executionMatch = summary.match(/Execution Time:\s*([\d.]+)\s*ms/);
  const rowsMatch = lines
    .find((l) => l.includes("rows="))
    ?.match(/rows=(\d+)/);

  const planningTime = planningMatch ? Number(planningMatch[1]) : 0;
  const executionTime = executionMatch ? Number(executionMatch[1]) : 0;
  const rows = rowsMatch ? Number(rowsMatch[1]) : 0;

  const hasSeqScan = lines.some((l) => l.startsWith("  ->  Seq Scan"));
  const hasIndexScan = lines.some(
    (l) => l.includes("Index Scan") || l.includes("Index Only Scan"),
  );

  return {
    description,
    planningTime,
    executionTime,
    totalTime: planningTime + executionTime,
    rows,
    indexUsed: hasIndexScan && !hasSeqScan,
  };
}

async function getTimestamp(offset = 0): Promise<Date> {
  const result = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT now()::timestamp as now`,
  );
  return (result?.[0]?.now as Date | undefined) ?? new Date();
}

async function main() {
  const now = await getTimestamp();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );

  console.log("=".repeat(80));
  console.log("MEDICIÓN DE IMPACTO DE ÍNDICES — EXPLAIN ANALYZE");
  console.log(`  Fecha: ${now.toISOString()}`);
  console.log(`  Mes: ${monthStart.toISOString().slice(0, 10)} / ${monthEnd.toISOString().slice(0, 10)}`);
  console.log("=".repeat(80));
  console.log();

  console.log(
    "NOTA: Las queries con 'dummy' en el filtro necesitan un ID real para",
  );
  console.log(
    "producir resultados significativos. Reemplazar 'dummy' por un ID",
  );
  console.log("válido de la BD antes de ejecutar.");
  console.log();

  const results: QueryTiming[] = [];

  // 1. Dashboard — aggregate PAID por profitCalculatedAt
  results.push(
    await explain(
      "Dashboard: aggregate PAID (1 mes)",
      `SELECT SUM(total), SUM("grossProfitPen") FROM "Order"
       WHERE status = 'PAID'
       AND "profitCalculatedAt" >= '${monthStart.toISOString()}'
       AND "profitCalculatedAt" <= '${monthEnd.toISOString()}'`,
    ),
  );

  // 2. Pedidos: listado sin filtro de status, ordenado por createdAt
  results.push(
    await explain(
      "Pedidos: listado ALL, orderBy createdAt DESC",
      `SELECT id, "orderNumber" FROM "Order"
       ORDER BY "createdAt" DESC LIMIT 20`,
    ),
  );

  // 3. Historial de movimientos de inventario
  results.push(
    await explain(
      "Inventario: movimientos x variantId DESC",
      `SELECT id, type, quantity FROM "InventoryMovement"
       WHERE "variantId" = 'dummy'
       ORDER BY "createdAt" DESC LIMIT 25`,
    ),
  );

  // 4. Pagos validados del día
  results.push(
    await explain(
      "Dashboard: pagos validados del día",
      `SELECT COALESCE(SUM(amount), 0) FROM "Payment"
       WHERE status = 'VALIDATED'
       AND "validatedAt" >= '${todayStart.toISOString()}'
       AND "validatedAt" <= '${todayEnd.toISOString()}'`,
    ),
  );

  // 5. Pagos de un cliente
  results.push(
    await explain(
      "Pagos: por customerId, orderBy createdAt",
      `SELECT id, method, status, amount FROM "Payment"
       WHERE "customerId" = 'dummy'
       ORDER BY "createdAt" DESC LIMIT 20`,
    ),
  );

  // 6. Applications de un payment
  results.push(
    await explain(
      "Pagos: applications por paymentId",
      `SELECT id, "orderId", amount FROM "PaymentApplication"
       WHERE "paymentId" = 'dummy'
       ORDER BY "createdAt" DESC`,
    ),
  );

  // 7. Envíos por status, orderBy createdAt
  results.push(
    await explain(
      "Envíos: listado PENDING, orderBy createdAt",
      `SELECT id, status FROM "Shipment"
       WHERE status = 'PENDING'
       ORDER BY "createdAt" DESC LIMIT 20`,
    ),
  );

  // 8. BatchItems de variante
  results.push(
    await explain(
      "BatchItems: variantId + calculatedAt NOT NULL",
      `SELECT id, "landedUnitCostPen", "quantityAvailable"
       FROM "ImportBatchItem"
       WHERE "variantId" = 'dummy'
       AND "calculatedAt" IS NOT NULL`,
    ),
  );

  // 9. Búsqueda de cliente por nombre
  results.push(
    await explain(
      "Clientes: búsqueda name ILIKE",
      `SELECT id, name FROM "Customer"
       WHERE name ILIKE '%a%' LIMIT 20`,
    ),
  );

  // 10. Aplications de un crédito
  results.push(
    await explain(
      "Créditos: applications por creditId",
      `SELECT id, "orderId", amount FROM "CustomerCreditApplication"
       WHERE "creditId" = 'dummy'
       ORDER BY "createdAt" DESC`,
    ),
  );

  console.log("RESULTADOS");
  console.log("-".repeat(80));
  console.log(
    "  #  | Query                               | Plan | Exec | Total | Filas | Índ",
  );
  console.log("-".repeat(80));

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const idx = (i + 1).toString().padStart(3);
    const desc = r.description.padEnd(38).slice(0, 38);
    const pTime = r.planningTime.toFixed(2).padStart(6);
    const eTime = r.executionTime.toFixed(2).padStart(6);
    const total = r.totalTime.toFixed(2).padStart(6);
    const rows = String(r.rows).padStart(5);
    const idxUsed = r.indexUsed ? "✅" : r.totalTime > 5 ? "🚫" : "⬜";
    console.log(
      `  ${idx} | ${desc} | ${pTime} | ${eTime} | ${total} | ${rows} | ${idxUsed}`,
    );
  }

  console.log();
  console.log("RECOMENDACIONES");
  console.log("-".repeat(80));
  for (const r of results) {
    if (!r.indexUsed && r.totalTime > 2) {
      console.log(
        `  ❌ ${r.description} — ${r.totalTime.toFixed(1)} ms`,
      );
    } else if (!r.indexUsed) {
      console.log(
        `  ⬜ ${r.description} — ${r.totalTime.toFixed(1)} ms (demasiado rápido)`,
      );
    } else {
      console.log(
        `  ✅ ${r.description} — ${r.totalTime.toFixed(1)} ms`,
      );
    }
  }

  console.log();
  console.log("LEGEND: ✅ = usa índice | 🚫 = sin índice >5ms | ⬜ = sin índice <5ms");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
