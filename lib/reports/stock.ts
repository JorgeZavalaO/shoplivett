import { Prisma } from "@prisma/client";

import { centsToDecimalString, type Cents } from "@/lib/money";
import { getPrisma } from "@/lib/prisma";
import {
  MAX_REPORT_ROWS,
  buildReportLimitMeta,
  trimReportRows,
  type ReportLimitMeta,
} from "@/lib/reports/shared/core";
import {
  legacyUnitCostCents,
  weightedUnitCostFromBatches,
} from "@/lib/reports/shared/variant-costing";

export type StockValuationRow = {
  variantId: string;
  variantCode: string;
  productName: string;
  categoryName: string;
  color: string | null;
  size: string | null;
  stock: number;
  reservedStock: number;
  available: number;
  unitCostCents: Cents;
  unitCost: string;
  totalCostCents: Cents;
  totalCost: string;
  hasBatches: boolean;
};

export type StockValuationReport = {
  rows: StockValuationRow[];
  totals: {
    units: number;
    totalCents: Cents;
    total: string;
    variantsWithBatches: number;
    variantsWithoutBatches: number;
    legacyTotalCents: Cents;
    legacyTotal: string;
  };
  meta: ReportLimitMeta;
};

export async function getStockValuationReport(
  options: { categoryId?: string | null; query?: string } = {},
): Promise<StockValuationReport> {
  const prisma = getPrisma();
  const trimmed = options.query?.trim() ?? "";
  const categoryId = options.categoryId?.trim() || null;
  const where: Prisma.ProductVariantWhereInput = {
    status: { not: "ARCHIVED" },
    ...(categoryId ? { product: { categoryId } } : {}),
    ...(trimmed
      ? {
          OR: [
            { code: { contains: trimmed, mode: "insensitive" } },
            { product: { name: { contains: trimmed, mode: "insensitive" } } },
            { color: { contains: trimmed, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [totalRows, variantsRaw] = await Promise.all([
    prisma.productVariant.count({ where }),
    prisma.productVariant.findMany({
      where,
      select: {
        id: true,
        code: true,
        color: true,
        size: true,
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
      orderBy: [{ product: { name: "asc" } }, { code: "asc" }],
      take: MAX_REPORT_ROWS + 1,
    }),
  ]);
  const { rows: variants, truncated } = trimReportRows(variantsRaw);

  const rows: StockValuationRow[] = [];
  let totalUnits = 0;
  let totalCents = 0;
  let legacyCents = 0;
  let withBatches = 0;
  let withoutBatches = 0;

  for (const v of variants) {
    const stock = v.stock;
    const hasBatches = v.batchItems.length > 0;
    let unitCostCents = 0;
    if (hasBatches) {
      unitCostCents = weightedUnitCostFromBatches(v.batchItems);
      withBatches += 1;
    } else {
      unitCostCents = legacyUnitCostCents(v.cost);
      withoutBatches += 1;
    }
    const lineCents = unitCostCents * stock;
    const reservedStock = v.reservedStock;
    const soldStock = v.soldStock;
    rows.push({
      variantId: v.id,
      variantCode: v.code,
      productName: v.product.name,
      categoryName: v.product.category?.name ?? "Sin categoría",
      color: v.color,
      size: v.size,
      stock,
      reservedStock,
      available: Math.max(0, stock - reservedStock - soldStock),
      unitCostCents,
      unitCost: centsToDecimalString(unitCostCents),
      totalCostCents: lineCents,
      totalCost: centsToDecimalString(lineCents),
      hasBatches,
    });
    totalUnits += stock;
    totalCents += lineCents;
    if (!hasBatches) legacyCents += lineCents;
  }

  return {
    rows,
    totals: {
      units: totalUnits,
      totalCents,
      total: centsToDecimalString(totalCents),
      variantsWithBatches: withBatches,
      variantsWithoutBatches: withoutBatches,
      legacyTotalCents: legacyCents,
      legacyTotal: centsToDecimalString(legacyCents),
    },
    meta: buildReportLimitMeta(rows.length, truncated, totalRows),
  };
}
