import { Prisma, SalesChannel } from "@prisma/client";

import { centsToDecimalString, toCents, type Cents } from "@/lib/money";
import { getPrisma } from "@/lib/prisma";
import { monthRange } from "@/lib/dashboard/overview";

export type ProductProfitabilityRow = {
  variantId: string;
  variantCode: string;
  productId: string;
  productName: string;
  categoryName: string;
  unitsSold: number;
  revenueCents: Cents;
  revenue: string;
  costCents: Cents;
  cost: string;
  grossProfitCents: Cents;
  grossProfit: string;
  marginBps: number;
};

export type ProductProfitabilityOrder = "TOP" | "BOTTOM";

export type ProductProfitabilityFilter = {
  year?: number;
  month?: number;
  salesChannel?: SalesChannel | "ALL";
  categoryId?: string | "ALL";
  limit?: number;
  order?: ProductProfitabilityOrder;
  minUnitsSold?: number;
};

export async function getProductProfitability(
  filter: ProductProfitabilityFilter = {},
): Promise<{
  rows: ProductProfitabilityRow[];
  filter: ProductProfitabilityFilter;
}> {
  const prisma = getPrisma();
  const current = new Date();
  const { year, month } = filter.year && filter.month
    ? { year: filter.year, month: filter.month }
    : { year: current.getFullYear(), month: current.getMonth() + 1 };
  const range = monthRange(year, month);
  const order: ProductProfitabilityOrder = filter.order ?? "TOP";
  const limit = Math.min(50, Math.max(1, filter.limit ?? 10));
  const minUnits = filter.minUnitsSold ?? 1;

  const where: Prisma.OrderItemWhereInput = {
    order: {
      status: "PAID",
      profitCalculatedAt: { gte: range.gte, lte: range.lte },
    },
    costSource: { in: ["BATCH", "LEGACY"] },
  };
  if (filter.salesChannel && filter.salesChannel !== "ALL") {
    where.order = {
      ...(where.order as Prisma.OrderWhereInput | undefined),
      salesChannel: filter.salesChannel,
    };
  }
  if (filter.categoryId && filter.categoryId !== "ALL") {
    where.variant = { product: { categoryId: filter.categoryId } };
  }

  const grouped = await prisma.orderItem.groupBy({
    by: ["variantId"],
    where,
    _sum: {
      quantity: true,
      lineTotal: true,
      totalCostPen: true,
      grossProfitPen: true,
    },
    orderBy: {
      _sum: { grossProfitPen: order === "TOP" ? "desc" : "asc" },
    },
    take: limit * 3,
  });

  if (grouped.length === 0) {
    return { rows: [], filter };
  }

  const variantIds = grouped.map((g) => g.variantId);
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    select: {
      id: true,
      code: true,
      product: {
        select: {
          id: true,
          name: true,
          category: { select: { id: true, name: true } },
        },
      },
    },
  });
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  const rows: ProductProfitabilityRow[] = [];
  for (const g of grouped) {
    const unitsSold = g._sum.quantity ?? 0;
    if (unitsSold < minUnits) continue;
    const revenueCents = toCents(g._sum.lineTotal);
    const costCents = toCents(g._sum.totalCostPen, { allowNegative: true });
    const grossProfitCents = toCents(g._sum.grossProfitPen, {
      allowNegative: true,
    });
    const marginBps =
      revenueCents > 0
        ? Math.round((grossProfitCents * 10000) / revenueCents)
        : 0;
    const v = variantMap.get(g.variantId);
    if (!v) continue;
    rows.push({
      variantId: g.variantId,
      variantCode: v.code,
      productId: v.product.id,
      productName: v.product.name,
      categoryName: v.product.category?.name ?? "Sin categoría",
      unitsSold,
      revenueCents,
      revenue: centsToDecimalString(revenueCents),
      costCents,
      cost: centsToDecimalString(costCents),
      grossProfitCents,
      grossProfit: centsToDecimalString(grossProfitCents),
      marginBps,
    });
  }

  rows.sort((a, b) =>
    order === "TOP"
      ? b.grossProfitCents - a.grossProfitCents
      : a.grossProfitCents - b.grossProfitCents,
  );

  return { rows: rows.slice(0, limit), filter };
}
