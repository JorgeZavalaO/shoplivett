// Test de regresión AUD-DATA-010: las mutaciones de lote deben revalidar
// `status !== CLOSED` DENTRO de la transacción Serializable, no solo antes
// de abrirla. Esto cierra la ventana de carrera donde un cierre concurrente
// del lote podía colarse junto con una edición en curso.
//
// Se ejecuta con: pnpm tsx scripts/_with-env.ts scripts/test-batch-closed-race.ts
// Corre contra la base de datos real: la prueba de carrera depende del
// comportamiento real de Postgres bajo aislamiento Serializable (SSI), no
// se puede simular con un mock.

import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { assertBatchNotClosed, BatchClosedError, BatchNotFoundError } from "../lib/import-batches";

let passed = 0;
let failed = 0;

async function run(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  fail ${name}`);
    console.error(error);
  }
}

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function isSerializationConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" || error.message.includes("serialization"))
  );
}

async function createBatch(code: string, status: "PURCHASED" | "IN_TRANSIT" | "COMPLETE" | "CLOSED") {
  return prisma.importBatch.create({
    data: {
      code,
      purchaseDate: new Date(),
      shopper: "Test",
      agency: "Test",
      totalCostUsd: "0.00",
      exchangeRate: "3.7500",
      totalInvestmentPen: "0.00",
      status,
      notes: null,
    },
  });
}

async function main() {
  const stamp = Date.now();

  console.log("AUD-DATA-010: revalidar CLOSED dentro de transacción Serializable\n");

  // --- Test 1: chequeo determinista, lote ya cerrado ---
  const closedBatch = await createBatch(`RACE-CLOSED-${stamp}`, "CLOSED");
  await run("assertBatchNotClosed lanza BatchClosedError si el lote ya está CLOSED", async () => {
    await assert.rejects(
      () =>
        prisma.$transaction(
          async (tx) => {
            await assertBatchNotClosed(tx, closedBatch.id, "No puedes modificar un lote cerrado.");
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        ),
      (error: unknown) => error instanceof BatchClosedError,
    );
  });

  // --- Test 2: baseline, lote abierto permite continuar ---
  const openBatch = await createBatch(`RACE-OPEN-${stamp}`, "COMPLETE");
  await run("assertBatchNotClosed no lanza si el lote no está CLOSED", async () => {
    await prisma.$transaction(
      async (tx) => {
        await assertBatchNotClosed(tx, openBatch.id);
        await tx.importBatch.update({
          where: { id: openBatch.id },
          data: { notes: "baseline-ok" },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    const fresh = await prisma.importBatch.findUniqueOrThrow({ where: { id: openBatch.id } });
    assert.equal(fresh.notes, "baseline-ok");
  });

  // --- Test 3: not found dentro de la transacción ---
  await run("assertBatchNotClosed lanza BatchNotFoundError si el lote no existe", async () => {
    await assert.rejects(
      () =>
        prisma.$transaction(
          async (tx) => {
            await assertBatchNotClosed(tx, "00000000-0000-0000-0000-000000000000");
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        ),
      (error: unknown) => error instanceof BatchNotFoundError,
    );
  });

  // --- Test 4 (el más importante): carrera real cierre vs edición ---
  const raceBatch = await createBatch(`RACE-CONCURRENT-${stamp}`, "COMPLETE");

  await run(
    "carrera: cierre concurrente aborta la edición en curso y el lote no queda con cambios aplicados",
    async () => {
      // Coordinación determinista (sin adivinar tiempos de red/latencia):
      // 1) mutateTx abre la transacción, revalida CLOSED (lee COMPLETE) y
      //    avisa que ya tomó su snapshot, luego se pausa.
      // 2) Recién ahí abrimos y esperamos a que closeTx cierre el lote de
      //    forma completa (commit confirmado).
      // 3) Solo entonces dejamos que mutateTx continúe con su escritura,
      //    garantizando que el cierre ya está commiteado cuando mutateTx
      //    intenta escribir sobre la misma fila.
      const readDone = deferred<void>();
      const proceedToWrite = deferred<void>();

      const mutateTx = prisma.$transaction(
        async (tx) => {
          await assertBatchNotClosed(tx, raceBatch.id, "No puedes modificar un lote cerrado.");
          readDone.resolve();
          await proceedToWrite.promise;
          await tx.importBatch.update({
            where: { id: raceBatch.id },
            data: { notes: "should-not-persist" },
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 20000,
          timeout: 30000,
        },
      );

      await readDone.promise;

      let closeSucceeded = true;
      try {
        await prisma.$transaction(
          async (tx) => {
            await tx.importBatch.update({
              where: { id: raceBatch.id },
              data: { status: "CLOSED" },
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch {
        closeSucceeded = false;
      }
      assert.ok(closeSucceeded, "el cierre concurrente debería completarse");

      proceedToWrite.resolve();

      const mutateResult = await mutateTx.then(
        () => ({ status: "fulfilled" as const, reason: undefined as unknown }),
        (reason: unknown) => ({ status: "rejected" as const, reason }),
      );

      // La mutación en curso debe fallar: el cierre ya está commiteado
      // cuando mutateTx intenta escribir sobre la misma fila, así que
      // Postgres debe detectar el conflicto de serializacion (SSI) al
      // intentar el UPDATE sobre una fila modificada por otra transacción
      // ya confirmada. Esto es justamente lo que valida AUD-DATA-010: la
      // revalidacion dentro de la transaccion + aislamiento Serializable
      // cierran la ventana de carrera.
      assert.equal(mutateResult.status, "rejected", "la edición concurrente debería fallar");
      if (mutateResult.status === "rejected") {
        const err = mutateResult.reason;
        const isExpected = err instanceof BatchClosedError || isSerializationConflict(err);
        assert.ok(
          isExpected,
          `error inesperado en mutateTx: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      // Invariante final: el lote quedó CLOSED y NUNCA con el cambio de
      // notes aplicado (no hay un estado intermedio corrupto).
      const finalState = await prisma.importBatch.findUniqueOrThrow({
        where: { id: raceBatch.id },
      });
      assert.equal(finalState.status, "CLOSED");
      assert.notEqual(finalState.notes, "should-not-persist");
    },
  );

  // --- Limpieza ---
  await prisma.importBatch.deleteMany({
    where: { code: { startsWith: "RACE-" } },
  });

  console.log(`\nTotal: ${passed} ok / ${failed} fail`);
  await prisma.$disconnect();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
