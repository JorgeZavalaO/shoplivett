// Modulo de dominio para Expenses (Sprint 22).
//
// Capa de lectura y agregaciones. Las mutaciones viven en actions/expenses.ts
// para mantener los server actions pequenos y reutilizables.
//
// Los gastos operativos se restan de la utilidad mensual de los pedidos PAID
// para producir la "utilidad neta real" del periodo (RF-S22-04, RF-S22-05).

import type { ExpenseCategory, ExpenseStatus, ExpenseType, Prisma } from "@prisma/client";

import { getPrisma } from "@/lib/prisma";
import { toCents, centsToDecimalString } from "@/lib/money";

export { EXPENSE_CATEGORY_LABELS, EXPENSE_TYPE_LABELS } from "@/lib/expenses-shared";

export const EXPENSE_LIST_SELECT = {
  id: true,
  expenseDate: true,
  category: true,
  expenseType: true,
  status: true,
  description: true,
  amount: true,
  paymentMethod: true,
  notes: true,
  voidedAt: true,
  voidReason: true,
  createdAt: true,
  createdBy: { select: { id: true, name: true } },
  voidedBy: { select: { id: true, name: true } },
} as const;

export const EXPENSE_DETAIL_SELECT = {
  id: true,
  expenseDate: true,
  category: true,
  expenseType: true,
  status: true,
  description: true,
  amount: true,
  paymentMethod: true,
  notes: true,
  voidedAt: true,
  voidReason: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true, email: true } },
  voidedBy: { select: { id: true, name: true, email: true } },
} as const;

export type ExpenseListItem = {
  id: string;
  expenseDate: Date;
  category: ExpenseCategory;
  expenseType: ExpenseType;
  status: ExpenseStatus;
  description: string;
  amount: { toString(): string };
  paymentMethod: string | null;
  notes: string | null;
  voidedAt: Date | null;
  voidReason: string | null;
  createdAt: Date;
  createdBy: { id: string; name: string } | null;
  voidedBy: { id: string; name: string } | null;
};

export type ExpenseListResult = {
  items: ExpenseListItem[];
  total: number;
  page: number;
  perPage: number;
  totalAmountCents: number;
  totalAmount: string;
  month: { year: number; month: number } | null;
  category: ExpenseCategory | "ALL";
  status: ExpenseStatus | "ALL";
  type: ExpenseType | "ALL";
  query: string;
};

export type ExpenseListFilter = {
  query?: string;
  category?: ExpenseCategory | "ALL";
  status?: ExpenseStatus | "ALL";
  type?: ExpenseType | "ALL";
  year?: number;
  month?: number; // 1-12
  page?: number;
  perPage?: number;
};

function monthRange(year: number, month: number): { gte: Date; lte: Date } {
  const gte = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const lastDay = new Date(year, month, 0).getDate();
  const lte = new Date(year, month - 1, lastDay, 23, 59, 59, 999);
  return { gte, lte };
}

function buildWhere(filter: ExpenseListFilter): Prisma.ExpenseWhereInput {
  const where: Prisma.ExpenseWhereInput = {};
  if (filter.category && filter.category !== "ALL") {
    where.category = filter.category;
  }
  if (filter.status && filter.status !== "ALL") {
    where.status = filter.status;
  }
  if (filter.type && filter.type !== "ALL") {
    where.expenseType = filter.type;
  }
  if (filter.year && filter.month) {
    where.expenseDate = monthRange(filter.year, filter.month);
  }
  const trimmed = filter.query?.trim() ?? "";
  if (trimmed) {
    where.OR = [
      { description: { contains: trimmed, mode: "insensitive" } },
      { notes: { contains: trimmed, mode: "insensitive" } },
      { paymentMethod: { contains: trimmed, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listExpenses(
  filter: ExpenseListFilter,
): Promise<ExpenseListResult> {
  const prisma = getPrisma();
  const safePage = Math.max(1, Math.floor(filter.page ?? 1));
  const safePerPage = Math.min(100, Math.max(1, Math.floor(filter.perPage ?? 20)));
  const trimmed = filter.query?.trim() ?? "";
  const where = buildWhere(filter);

  const [total, items, totalAmountAgg] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.findMany({
      where,
      orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
      skip: (safePage - 1) * safePerPage,
      take: safePerPage,
      select: EXPENSE_LIST_SELECT,
    }),
    prisma.expense.aggregate({
      where: { ...where, status: "ACTIVE" },
      _sum: { amount: true },
    }),
  ]);

  const totalAmountCents = toCents(totalAmountAgg._sum.amount);

  return {
    items: items as unknown as ExpenseListItem[],
    total,
    page: safePage,
    perPage: safePerPage,
    totalAmountCents,
    totalAmount: centsToDecimalString(totalAmountCents),
    month:
      filter.year && filter.month
        ? { year: filter.year, month: filter.month }
        : null,
    category: filter.category ?? "ALL",
    status: filter.status ?? "ALL",
    type: filter.type ?? "ALL",
    query: trimmed,
  };
}

export async function getExpenseDetail(id: string) {
  const prisma = getPrisma();
  return prisma.expense.findUnique({
    where: { id },
    select: EXPENSE_DETAIL_SELECT,
  });
}

// =====================================================================
// Agregadores financieros del periodo
// =====================================================================

export type ExpenseMonthlySummary = {
  year: number;
  month: number; // 1-12
  totalCents: number;
  total: string;
  byCategory: Array<{
    category: ExpenseCategory;
    totalCents: number;
    total: string;
    count: number;
  }>;
  fixedCents: number;
  variableCents: number;
};

export async function getMonthlyExpenseSummary(
  year: number,
  month: number,
): Promise<ExpenseMonthlySummary> {
  const prisma = getPrisma();
  const { gte, lte } = monthRange(year, month);

  const where: Prisma.ExpenseWhereInput = {
    status: "ACTIVE",
    expenseDate: { gte, lte },
  };

  const [agg, byCategoryRows] = await Promise.all([
    prisma.expense.aggregate({
      where,
      _sum: { amount: true },
    }),
    prisma.expense.groupBy({
      by: ["category"],
      where,
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const totalCents = toCents(agg._sum.amount);

  const fixedAgg = await prisma.expense.aggregate({
    where: { ...where, expenseType: "FIXED" },
    _sum: { amount: true },
  });
  const variableAgg = await prisma.expense.aggregate({
    where: { ...where, expenseType: "VARIABLE" },
    _sum: { amount: true },
  });
  const fixedCents = toCents(fixedAgg._sum.amount);
  const variableCents = toCents(variableAgg._sum.amount);

  const byCategory = byCategoryRows
    .map((row) => {
      const cents = toCents(row._sum.amount);
      return {
        category: row.category,
        totalCents: cents,
        total: centsToDecimalString(cents),
        count: row._count._all,
      };
    })
    .sort((a, b) => b.totalCents - a.totalCents);

  return {
    year,
    month,
    totalCents,
    total: centsToDecimalString(totalCents),
    byCategory,
    fixedCents,
    variableCents,
  };
}

export type FinancialPeriod = {
  year: number;
  month: number;
  revenueCents: number;
  productCostCents: number;
  grossProfitCents: number;
  paymentFeeCents: number;
  packagingCostCents: number;
  netProfitCents: number; // utilidad operativa antes de gastos
  expensesCents: number;
  incidentLossCents: number;
  incidentRecoveredCents: number;
  realNetProfitCents: number; // utilidad neta real del periodo
  marginBps: number; // margen real del periodo (realNetProfit / revenue)
};

export async function getFinancialPeriod(
  year: number,
  month: number,
): Promise<FinancialPeriod> {
  const prisma = getPrisma();
  const { gte, lte } = monthRange(year, month);

  const [revenueAgg, productCostAgg, grossProfitAgg, paymentFeeAgg, packagingAgg, expensesAgg, incidentsLossAgg] =
    await Promise.all([
      prisma.order.aggregate({
        where: {
          status: "PAID",
          profitCalculatedAt: { gte, lte },
        },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: {
          status: "PAID",
          profitCalculatedAt: { gte, lte },
        },
        _sum: { productCostPen: true },
      }),
      prisma.order.aggregate({
        where: {
          status: "PAID",
          profitCalculatedAt: { gte, lte },
        },
        _sum: { grossProfitPen: true },
      }),
      prisma.order.aggregate({
        where: {
          status: "PAID",
          profitCalculatedAt: { gte, lte },
        },
        _sum: { paymentFeePen: true },
      }),
      prisma.order.aggregate({
        where: {
          status: "PAID",
          profitCalculatedAt: { gte, lte },
        },
        _sum: { packagingCostPen: true },
      }),
      prisma.expense.aggregate({
        where: { status: "ACTIVE", expenseDate: { gte, lte } },
        _sum: { amount: true },
      }),
      prisma.incident.aggregate({
        where: { status: { not: "CANCELLED" }, incidentDate: { gte, lte } },
        _sum: { lostAmount: true, recoveredAmount: true },
      }),
    ]);

  const revenueCents = toCents(revenueAgg._sum.total);
  const productCostCents = toCents(productCostAgg._sum.productCostPen, {
    allowNegative: true,
  });
  const grossProfitCents = toCents(grossProfitAgg._sum.grossProfitPen, {
    allowNegative: true,
  });
  const paymentFeeCents = toCents(paymentFeeAgg._sum.paymentFeePen, {
    allowNegative: true,
  });
  const packagingCostCents = toCents(packagingAgg._sum.packagingCostPen, {
    allowNegative: true,
  });
  const expensesCents = toCents(expensesAgg._sum.amount);
  const incidentLossCents = toCents(incidentsLossAgg._sum.lostAmount, {
    allowNegative: true,
  });
  const incidentRecoveredCents = toCents(incidentsLossAgg._sum.recoveredAmount, {
    allowNegative: true,
  });

  const netProfitCents = grossProfitCents - paymentFeeCents - packagingCostCents;
  const realNetProfitCents =
    netProfitCents - expensesCents - incidentLossCents;
  const marginBps =
    revenueCents > 0
      ? Math.round((realNetProfitCents * 10000) / revenueCents)
      : 0;

  return {
    year,
    month,
    revenueCents,
    productCostCents,
    grossProfitCents,
    paymentFeeCents,
    packagingCostCents,
    netProfitCents,
    expensesCents,
    incidentLossCents,
    incidentRecoveredCents,
    realNetProfitCents,
    marginBps,
  };
}
