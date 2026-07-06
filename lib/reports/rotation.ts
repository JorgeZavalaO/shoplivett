import { centsToDecimalString, type Cents } from "@/lib/money";
import { getPrisma } from "@/lib/prisma";
import {
  MAX_REPORT_ROWS,
  buildReportLimitMeta,
  trimReportRows,
  type ReportLimitMeta,
} from "@/lib/reports/shared/core";
import { getLastSoldByVariant } from "@/lib/reports/shared/last-sale";
import {
  legacyUnitCostCents,
  weightedUnitCostFromBatches,
} from "@/lib/reports/shared/variant-costing";

export type LowRotationRow = {
  variantId: string;
  variantCode: string;
  productName: string;
  categoryName: string;
  color: string | null;
  stock: number;
  reservedStock: number;
  soldStock: number;
  stockValueCents: Cents;
  stockValue: string;
  lastSoldAt: Date | null;
  daysSinceLastSale: number | null;
};

export type LowRotationReport = {
  rows: LowRotationRow[];
  thresholdDays: number;
  totals: {
    units: number;
    valueCents: Cents;
    value: string;
  };
  meta: ReportLimitMeta;
};

export async function getLowRotationReport(
  options: { days?: number; categoryId?: string | null } = {},
): Promise<LowRotationReport> {
  const prisma = getPrisma();
  const safeDays = Math.max(1, Math.min(365, Math.floor(options.days ?? 60)));
  const categoryId = options.categoryId?.trim() || null;
  const threshold = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

  const variantsRaw = await prisma.productVariant.findMany({
    where: {
      status: { not: "ARCHIVED" },
      OR: [{ stock: { gt: 0 } }, { soldStock: { gt: 0 } }],
      ...(categoryId ? { product: { categoryId } } : {}),
    },
    select: {
      id: true,
      code: true,
      color: true,
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
    orderBy: [{ stock: "desc" }, { code: "asc" }],
    take: MAX_REPORT_ROWS + 1,
  });
  const { rows: variants, truncated } = trimReportRows(variantsRaw);

  const variantIds = variants.map((v) => v.id);
  const lastSoldByVariant = await getLastSoldByVariant(prisma, variantIds);

  const rows: LowRotationRow[] = [];
  let totalUnits = 0;
  let totalCents = 0;

  for (const v of variants) {
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
      productName: v.product.name,
      categoryName: v.product.category?.name ?? "Sin categoría",
      color: v.color,
      stock: v.stock,
      reservedStock: v.reservedStock,
      soldStock: v.soldStock,
      stockValueCents,
      stockValue: centsToDecimalString(stockValueCents),
      lastSoldAt,
      daysSinceLastSale,
    });
    totalUnits += v.stock;
    totalCents += stockValueCents;
  }

  rows.sort((a, b) => {
    if (b.stock !== a.stock) return b.stock - a.stock;
    const aDays = a.daysSinceLastSale ?? Number.MAX_SAFE_INTEGER;
    const bDays = b.daysSinceLastSale ?? Number.MAX_SAFE_INTEGER;
    return bDays - aDays;
  });

  return {
    rows,
    thresholdDays: safeDays,
    totals: {
      units: totalUnits,
      valueCents: totalCents,
      value: centsToDecimalString(totalCents),
    },
    meta: buildReportLimitMeta(rows.length, truncated),
  };
}
