"use server";

import { requireRole } from "@/lib/permissions";
import {
  getBatchProfitabilityReport,
  getCustomersFinancialReport,
  getExpensesReport,
  getLowRotationReport,
  getProductProfitabilityReport,
  getReturnsLossesReport,
  getSalesByMonthReport,
  getStockValuationReport,
  type ReportDateRange,
} from "@/lib/financial-reports";
import type { ExpenseListFilter } from "@/lib/expenses";

export async function getSalesByMonthReportAction(range: ReportDateRange) {
  await requireRole("ADMIN");
  return getSalesByMonthReport(range);
}

export async function getProductProfitabilityReportAction(
  range: ReportDateRange,
  options: { categoryId?: string | null; minUnits?: number } = {},
) {
  await requireRole("ADMIN");
  return getProductProfitabilityReport(range, options);
}

export async function getBatchProfitabilityReportAction(range: ReportDateRange) {
  await requireRole("ADMIN");
  return getBatchProfitabilityReport(range);
}

export async function getStockValuationReportAction(
  options: { categoryId?: string | null; query?: string } = {},
) {
  await requireRole("ADMIN");
  return getStockValuationReport(options);
}

export async function getLowRotationReportAction(
  options: { days?: number; categoryId?: string | null } = {},
) {
  await requireRole("ADMIN");
  return getLowRotationReport(options);
}

export async function getExpensesReportAction(filter: ExpenseListFilter) {
  await requireRole("ADMIN");
  return getExpensesReport(filter);
}

export async function getCustomersFinancialReportAction(
  range: ReportDateRange,
  options: { query?: string } = {},
) {
  await requireRole("ADMIN");
  return getCustomersFinancialReport(range, options);
}

export async function getReturnsLossesReportAction(
  range: ReportDateRange,
  options: { type?: string; status?: string; decision?: string } = {},
) {
  await requireRole("ADMIN");
  return getReturnsLossesReport(range, options);
}
