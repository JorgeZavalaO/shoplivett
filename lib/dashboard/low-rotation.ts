import { centsToDecimalString, type Cents } from "@/lib/money";
import { getPrisma } from "@/lib/prisma";
import { getLastSoldByVariant } from "@/lib/reports/shared/last-sale";
import {
  legacyUnitCostCents,
  weightedUnitCostFromBatches,
} from "@/lib/reports/shared/variant-costing";

export type LowRotationRow = {
  variantId: string;
  variantCode: string;
  productId: string;
  productName: string;
  categoryName: string;
  stock: number;
  reservedStock: number;
  soldStock: number;
  stockValueCents: Cents;
  stockValue: string;
  lastSoldAt: Date | null;
  daysSinceLastSale: number | null;
};

export async function getLowRotationProducts(
  days = 60,
  limit = 10,
): Promise<{ rows: LowRotationRow[]; thresholdDays: number }> {
  const prisma = getPrisma();
  const safeDays = Math.max(1, Math.min(365, Math.floor(days)));
  const safeLimit = Math.min(50, Math.max(1, Math.floor(limit)));
  const threshold = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

  const variants = await prisma.productVariant.findMany({
    where: {
      status: { not: "ARCHIVED" },
      OR: [{ stock: { gt: 0 } }, { soldStock: { gt: 0 } }],
    },
    select: {
      id: true,
      code: true,
      stock: true,
      reservedStock: true,
      soldStock: true,
      cost: true,
      product: {
        select: {
          id: true,
          name: true,
          category: { select: { id: true, name: true } },
        },
      },
      batchItems: {
        where: { calculatedAt: { not: null } },
        select: { landedUnitCostPen: true, quantityAvailable: true },
      },
    },
  });

  const variantIds = variants.map((v) => v.id);
  const lastSoldByVariant = await getLastSoldByVariant(prisma, variantIds);

  const rows: LowRotationRow[] = [];
  for (const v of variants) {
    if (v.stock <= 0 && v.soldStock <= 0) continue;

    const lastSoldAt = lastSoldByVariant.get(v.id) ?? null;
    if (lastSoldAt && lastSoldAt >= threshold) continue;
    const daysSinceLastSale = lastSoldAt
      ? Math.floor((Date.now() - lastSoldAt.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    let stockValueCents = 0;
    if (v.batchItems.length > 0) {
      stockValueCents = weightedUnitCostFromBatches(v.batchItems) * v.stock;
    } else {
      stockValueCents = legacyUnitCostCents(v.cost) * v.stock;
    }

    rows.push({
      variantId: v.id,
      variantCode: v.code,
      productId: v.product.id,
      productName: v.product.name,
      categoryName: v.product.category?.name ?? "Sin categoría",
      stock: v.stock,
      reservedStock: v.reservedStock,
      soldStock: v.soldStock,
      stockValueCents,
      stockValue: centsToDecimalString(stockValueCents),
      lastSoldAt,
      daysSinceLastSale,
    });
  }

  rows.sort((a, b) => {
    if (b.stock !== a.stock) return b.stock - a.stock;
    const aDays = a.daysSinceLastSale ?? Number.MAX_SAFE_INTEGER;
    const bDays = b.daysSinceLastSale ?? Number.MAX_SAFE_INTEGER;
    return bDays - aDays;
  });

  return {
    rows: rows.slice(0, safeLimit),
    thresholdDays: safeDays,
  };
}
