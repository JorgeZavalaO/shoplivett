import { centsToDecimalString, type Cents } from "@/lib/money";
import {
  getFinancialPeriod as _getFinancialPeriod,
  listExpenses,
  type ExpenseListFilter,
  type ExpenseListResult,
} from "@/lib/expenses";
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_TYPE_LABELS,
} from "@/lib/expenses-shared";
import {
  MAX_REPORT_ROWS,
  buildReportLimitMeta,
  resolveCents,
  type ReportDateRange,
  type ReportLimitMeta,
} from "@/lib/reports/shared/core";

export type FinancialExpensesRow = {
  id: string;
  expenseDate: Date;
  category: string;
  categoryLabel: string;
  expenseType: string;
  expenseTypeLabel: string;
  description: string;
  amountCents: Cents;
  amount: string;
  paymentMethod: string | null;
  status: string;
  notes: string | null;
};

export type FinancialExpensesReport = {
  rows: FinancialExpensesRow[];
  totals: {
    activeCents: Cents;
    active: string;
    voidedCents: Cents;
    voided: string;
    count: number;
  };
  range: ReportDateRange;
  category: string | "ALL";
  type: string | "ALL";
  status: string | "ALL";
  meta: ReportLimitMeta;
};

export async function getExpensesReport(
  filter: ExpenseListFilter,
): Promise<FinancialExpensesReport> {
  const requestedPerPage = Math.max(
    1,
    Math.floor(filter.perPage ?? MAX_REPORT_ROWS),
  );
  const reportPerPage = Math.min(MAX_REPORT_ROWS, requestedPerPage);
  const result: ExpenseListResult = await listExpenses({
    year: filter.year,
    month: filter.month,
    category: filter.category,
    status: filter.status,
    type: filter.type,
    query: filter.query,
    page: Math.max(1, Math.floor(filter.page ?? 1)),
    perPage: reportPerPage,
  });
  const rows: FinancialExpensesRow[] = result.items.map((it) => ({
    id: it.id,
    expenseDate: it.expenseDate,
    category: it.category,
    categoryLabel: EXPENSE_CATEGORY_LABELS[it.category] ?? it.category,
    expenseType: it.expenseType,
    expenseTypeLabel: EXPENSE_TYPE_LABELS[it.expenseType] ?? it.expenseType,
    description: it.description,
    amountCents: resolveCents(it.amount),
    amount: centsToDecimalString(resolveCents(it.amount)),
    paymentMethod: it.paymentMethod,
    status: it.status,
    notes: it.notes,
  }));
  let activeCents = 0;
  let voidedCents = 0;
  for (const r of rows) {
    if (r.status === "ACTIVE") activeCents += r.amountCents;
    else voidedCents += r.amountCents;
  }
  return {
    rows,
    totals: {
      activeCents,
      active: centsToDecimalString(activeCents),
      voidedCents,
      voided: centsToDecimalString(voidedCents),
      count: rows.length,
    },
    range:
      filter.year && filter.month
        ? {
            from: new Date(filter.year, filter.month - 1, 1),
            to: new Date(filter.year, filter.month, 0, 23, 59, 59, 999),
          }
        : { from: null, to: null },
    category: filter.category ?? "ALL",
    type: filter.type ?? "ALL",
    status: filter.status ?? "ALL",
    meta: buildReportLimitMeta(
      rows.length,
      result.total > rows.length,
      result.total,
    ),
  };
}

void _getFinancialPeriod;
