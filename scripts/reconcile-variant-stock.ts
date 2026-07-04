// Reconcilia ProductVariant.stock contra sum(ImportBatchItem.quantityAvailable)
// (AUD-DATA-004, opcion B con sincronizacion).
//
// Uso:
//   pnpm exec tsx scripts/_with-env.ts scripts/reconcile-variant-stock.ts
//   pnpm exec tsx scripts/_with-env.ts scripts/reconcile-variant-stock.ts --apply
//
// Sin --apply: solo reporta drift.
// Con --apply: corrige `ProductVariant.stock` al valor de la suma de batches
// (solo en variantes que tienen al menos un ImportBatchItem, porque las
// variantes sin lote operan por stock legacy). Las variantes sin lote no se
// tocan.

import assert from "node:assert/strict";

import { prisma } from "../lib/prisma";

type Drift = {
  variantId: string;
  code: string;
  productName: string;
  currentStock: number;
  batchSum: number;
  delta: number;
};

let reported = 0;
let applied = 0;
let skipped = 0;

async function main() {
  const apply = process.argv.includes("--apply");

  const variants = await prisma.productVariant.findMany({
    where: { batchItems: { some: {} } },
    select: {
      id: true,
      code: true,
      stock: true,
      product: { select: { name: true } },
      _count: { select: { batchItems: true } },
    },
    orderBy: { code: "asc" },
  });

  const drift: Drift[] = [];
  for (const v of variants) {
    const sum = await prisma.importBatchItem.aggregate({
      where: { variantId: v.id },
      _sum: { quantityAvailable: true },
    });
    const batchSum = sum._sum.quantityAvailable ?? 0;
    if (batchSum !== v.stock) {
      drift.push({
        variantId: v.id,
        code: v.code,
        productName: v.product.name,
        currentStock: v.stock,
        batchSum,
        delta: batchSum - v.stock,
      });
    }
  }

  console.log(
    `[reconcile-variant-stock] variantes con batch: ${variants.length}, drift: ${drift.length}${apply ? " (aplicando)" : ""}`,
  );
  for (const d of drift) {
    reported += 1;
    console.log(
      `  - ${d.code} (${d.productName}): stock=${d.currentStock} != sum(quantityAvailable)=${d.batchSum} -> delta=${d.delta}`,
    );
  }

  if (apply && drift.length > 0) {
    for (const d of drift) {
      try {
        const result = await prisma.productVariant.updateMany({
          where: { id: d.variantId },
          data: { stock: d.batchSum },
        });
        if (result.count === 1) {
          applied += 1;
        } else {
          skipped += 1;
          console.log(`    skip ${d.code}: variante no encontrada`);
        }
      } catch (err) {
        skipped += 1;
        console.log(`    skip ${d.code}: ${(err as Error).message}`);
      }
    }
  }

  console.log(
    `[reconcile-variant-stock] resultado: reportados=${reported} aplicados=${applied} saltados=${skipped}`,
  );
  assert.ok(reported === drift.length, "drift report count mismatch");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
