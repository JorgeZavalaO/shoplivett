// Sync entre `ImportBatchItem.quantityAvailable` y `ProductVariant.stock`.
//
// Regla (AUD-DATA-004, opcion B): `ProductVariant.stock` es una proyeccion
// denormalizada de la suma de `quantityAvailable` de los items de lote de la
// variante. Toda mutacion de `ImportBatchItem.quantityAvailable` debe ir
// acompaniada del delta correspondiente en `ProductVariant.stock` dentro de la
// misma transaccion. Las mutaciones de ventas/reservas (reserve/confirm) y de
// incidencias siguen actualizando PV.stock de forma independiente y tambien
// emiten el delta aqui para mantener la invariante `PV.stock == sum(quantityAvailable)`
// en operaciones que afectan ambos lados.
//
// Toda escritura pasa primero por `assertVariantStockInvariant` en modo dev
// (NODE_ENV !== "production") para detectar drift antes de que se propague.

import { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export function assertVariantStockInvariant(
  tx: Tx,
  variantId: string,
  label: string,
): Promise<void> {
  if (process.env.NODE_ENV === "production") return Promise.resolve();
  return tx.productVariant
    .findUnique({
      where: { id: variantId },
      select: { stock: true },
    })
    .then(async (variant) => {
      if (!variant) return;
      const sum = await tx.importBatchItem.aggregate({
        where: { variantId },
        _sum: { quantityAvailable: true },
      });
      const batchSum = sum._sum.quantityAvailable ?? 0;
      if (variant.stock !== batchSum) {
        // Solo logueamos en dev; no abortamos la transaccion para no
        // introducir comportamiento divergente entre entornos.
        console.warn(
          `[AUD-DATA-004 drift] ${label}: variant ${variantId} stock=${variant.stock} != sum(quantityAvailable)=${batchSum}`,
        );
      }
    });
}

/**
 * Sincroniza `ProductVariant.stock` con un delta en `quantityAvailable` del
 * lote. Usar dentro de la misma transaccion que la mutacion de
 * `ImportBatchItem` para que ambas escrituras sean atomicas.
 */
export async function applyBatchStockDelta(
  tx: Tx,
  args: { variantId: string; delta: number; label: string },
): Promise<void> {
  if (args.delta === 0) return;
  const updated = await tx.productVariant.updateMany({
    where: { id: args.variantId },
    data: { stock: { increment: args.delta } },
  });
  if (updated.count !== 1) {
    throw new Error(
      `[AUD-DATA-004] ${args.label}: variante ${args.variantId} no encontrada al sincronizar stock.`,
    );
  }
}
