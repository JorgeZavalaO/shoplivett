import { type Prisma, SalesChannel } from "@prisma/client";

import { centsToDecimalString, toCents, type Cents } from "@/lib/money";
import { getPrisma } from "@/lib/prisma";

export type FinancialDashboardFilter = {
  year?: number;
  month?: number;
  salesChannel?: SalesChannel | "ALL";
  batchId?: string | "ALL";
  categoryId?: string | "ALL";
};

export function monthRange(
  year: number,
  month: number,
): { gte: Date; lte: Date } {
  const gte = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const lastDay = new Date(year, month, 0).getDate();
  const lte = new Date(year, month - 1, lastDay, 23, 59, 59, 999);
  return { gte, lte };
}

function resolveCurrentPeriod(now: Date = new Date()): {
  year: number;
  month: number;
} {
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function buildOrderWhere(
  range: { gte: Date; lte: Date },
  filter: FinancialDashboardFilter,
): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {
    status: "PAID",
    profitCalculatedAt: { gte: range.gte, lte: range.lte },
  };
  if (filter.salesChannel && filter.salesChannel !== "ALL") {
    where.salesChannel = filter.salesChannel;
  }
  const itemConditions: Prisma.OrderItemWhereInput[] = [];
  if (filter.batchId && filter.batchId !== "ALL") {
    itemConditions.push({
      allocations: { some: { batchId: filter.batchId } },
    });
  }
  if (filter.categoryId && filter.categoryId !== "ALL") {
    itemConditions.push({
      variant: { product: { categoryId: filter.categoryId } },
    });
  }
  if (itemConditions.length > 0) {
    where.items = { some: { AND: itemConditions } };
  }
  return where;
}

export type FinancialOverview = {
  year: number;
  month: number;
  filter: FinancialDashboardFilter;
  revenueCents: Cents;
  revenue: string;
  productCostCents: Cents;
  productCost: string;
  grossProfitCents: Cents;
  grossProfit: string;
  paymentFeeCents: Cents;
  paymentFee: string;
  packagingCostCents: Cents;
  packagingCost: string;
  deliveryBusinessCostCents: Cents;
  deliveryBusinessCost: string;
  netProfitCents: Cents;
  netProfit: string;
  expensesCents: Cents;
  expenses: string;
  incidentLossCents: Cents;
  incidentLoss: string;
  incidentRecoveredCents: Cents;
  incidentRecovered: string;
  realNetProfitCents: Cents;
  realNetProfit: string;
  marginBps: number;
  ordersCount: number;
};

export async function getFinancialOverview(
  filter: FinancialDashboardFilter = {},
): Promise<FinancialOverview> {
  const prisma = getPrisma();
  const { year, month } = {
    ...resolveCurrentPeriod(),
    ...(filter.year && filter.month
      ? { year: filter.year, month: filter.month }
      : {}),
  };
  const range = monthRange(year, month);
  const orderWhere = buildOrderWhere(range, filter);

  const [ordersAgg, ordersCount, expensesAgg, incidentLossAgg] =
    await Promise.all([
      prisma.order.aggregate({
        where: orderWhere,
        _sum: {
          total: true,
          productCostPen: true,
          grossProfitPen: true,
          paymentFeePen: true,
          packagingCostPen: true,
          deliveryBusinessCostPen: true,
        },
      }),
      prisma.order.count({ where: orderWhere }),
      prisma.expense.aggregate({
        where: {
          status: "ACTIVE",
          expenseDate: { gte: range.gte, lte: range.lte },
        },
        _sum: { amount: true },
      }),
      prisma.incident.aggregate({
        where: {
          status: { not: "CANCELLED" },
          incidentDate: { gte: range.gte, lte: range.lte },
        },
        _sum: { lostAmount: true, recoveredAmount: true },
      }),
    ]);

  const revenueCents = toCents(ordersAgg._sum.total);
  const productCostCents = toCents(ordersAgg._sum.productCostPen, {
    allowNegative: true,
  });
  const grossProfitCents = toCents(ordersAgg._sum.grossProfitPen, {
    allowNegative: true,
  });
  const paymentFeeCents = toCents(ordersAgg._sum.paymentFeePen, {
    allowNegative: true,
  });
  const packagingCostCents = toCents(ordersAgg._sum.packagingCostPen, {
    allowNegative: true,
  });
  const deliveryBusinessCostCents = toCents(
    ordersAgg._sum.deliveryBusinessCostPen,
    {
      allowNegative: true,
    },
  );
  const expensesCents = toCents(expensesAgg._sum.amount);
  const incidentLossCents = toCents(incidentLossAgg._sum.lostAmount, {
    allowNegative: true,
  });
  const incidentRecoveredCents = toCents(
    incidentLossAgg._sum.recoveredAmount,
    { allowNegative: true },
  );

  const netProfitCents =
    grossProfitCents -
    paymentFeeCents -
    packagingCostCents -
    deliveryBusinessCostCents;
  const realNetProfitCents =
    netProfitCents - expensesCents - incidentLossCents + incidentRecoveredCents;
  const marginBps =
    revenueCents > 0
      ? Math.round((realNetProfitCents * 10000) / revenueCents)
      : 0;

  return {
    year,
    month,
    filter,
    revenueCents,
    revenue: centsToDecimalString(revenueCents),
    productCostCents,
    productCost: centsToDecimalString(productCostCents),
    grossProfitCents,
    grossProfit: centsToDecimalString(grossProfitCents),
    paymentFeeCents,
    paymentFee: centsToDecimalString(paymentFeeCents),
    packagingCostCents,
    packagingCost: centsToDecimalString(packagingCostCents),
    deliveryBusinessCostCents,
    deliveryBusinessCost: centsToDecimalString(deliveryBusinessCostCents),
    netProfitCents,
    netProfit: centsToDecimalString(netProfitCents),
    expensesCents,
    expenses: centsToDecimalString(expensesCents),
    incidentLossCents,
    incidentLoss: centsToDecimalString(incidentLossCents),
    incidentRecoveredCents,
    incidentRecovered: centsToDecimalString(incidentRecoveredCents),
    realNetProfitCents,
    realNetProfit: centsToDecimalString(realNetProfitCents),
    marginBps,
    ordersCount,
  };
}
