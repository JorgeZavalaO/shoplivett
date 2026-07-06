import { centsToDecimalString, type Cents } from "@/lib/money";
import { getPrisma } from "@/lib/prisma";
import {
  legacyUnitCostCents,
  weightedUnitCostFromBatches,
} from "@/lib/reports/shared/variant-costing";

export type StockValuation = {
  totalUnits: number;
  totalCents: Cents;
  total: string;
  byCategory: Array<{
    categoryId: string;
    categoryName: string;
    units: number;
    totalCents: Cents;
    total: string;
  }>;
  variantsWithBatches: number;
  variantsWithoutBatches: number;
  fallbackLegacyValueCents: Cents;
  fallbackLegacyValue: string;
};

export async function getStockValuation(): Promise<StockValuation> {
  const prisma = getPrisma();

  const variants = await prisma.productVariant.findMany({
    where: { status: { not: "ARCHIVED" } },
    select: {
      id: true,
      stock: true,
      cost: true,
      product: {
        select: { categoryId: true, category: { select: { id: true, name: true } } },
      },
      batchItems: {
        where: { calculatedAt: { not: null } },
        select: { landedUnitCostPen: true, quantityAvailable: true },
      },
    },
  });

  let totalUnits = 0;
  let totalCents = 0;
  let fallbackLegacyValueCents = 0;
  let variantsWithBatches = 0;
  let variantsWithoutBatches = 0;
  const byCategoryMap = new Map<
    string,
    { id: string; name: string; units: number; cents: number }
  >();

  for (const v of variants) {
    const stock = v.stock;
    if (stock <= 0) continue;
    totalUnits += stock;

    const categoryId = v.product.categoryId;
    const categoryName = v.product.category?.name ?? "Sin categoría";
    const catAcc = byCategoryMap.get(categoryId) ?? {
      id: categoryId,
      name: categoryName,
      units: 0,
      cents: 0,
    };
    catAcc.units += stock;

    if (v.batchItems.length > 0) {
      variantsWithBatches += 1;
      const unitCostCents = weightedUnitCostFromBatches(v.batchItems);
      const lineCents = unitCostCents * stock;
      totalCents += lineCents;
      catAcc.cents += lineCents;
    } else {
      variantsWithoutBatches += 1;
      const legacyUnitCents = legacyUnitCostCents(v.cost);
      const lineCents = legacyUnitCents * stock;
      totalCents += lineCents;
      catAcc.cents += lineCents;
      fallbackLegacyValueCents += lineCents;
    }
    byCategoryMap.set(categoryId, catAcc);
  }

  const byCategory = [...byCategoryMap.values()]
    .map((c) => ({
      categoryId: c.id,
      categoryName: c.name,
      units: c.units,
      totalCents: c.cents,
      total: centsToDecimalString(c.cents),
    }))
    .sort((a, b) => b.totalCents - a.totalCents);

  return {
    totalUnits,
    totalCents,
    total: centsToDecimalString(totalCents),
    byCategory,
    variantsWithBatches,
    variantsWithoutBatches,
    fallbackLegacyValueCents,
    fallbackLegacyValue: centsToDecimalString(fallbackLegacyValueCents),
  };
}
