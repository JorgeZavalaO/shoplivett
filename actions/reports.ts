"use server";

import { requireRole } from "@/lib/permissions";
import {
  getCreditsReport,
  getLivesReport,
  getPaymentsReport,
  getPendingBalancesReport,
  getReportSummary,
  getStockReport,
  getTopProductsReport,
  listCategoryOptions,
  type CreditsReportFilter,
  type LivesReportFilter,
  type PaymentsReportFilter,
  type PendingBalancesFilter,
  type ReportRange,
  type StockReportFilter,
  type TopProductsFilter,
} from "@/lib/reports";

export async function getReportSummaryAction(filter: ReportRange) {
  await requireRole("ADMIN");
  return getReportSummary(filter);
}

export async function getPaymentsReportAction(filter: PaymentsReportFilter) {
  await requireRole("ADMIN");
  return getPaymentsReport(filter);
}

export async function getPendingBalancesReportAction(
  filter: PendingBalancesFilter,
) {
  await requireRole("ADMIN");
  return getPendingBalancesReport(filter);
}

export async function getCreditsReportAction(filter: CreditsReportFilter) {
  await requireRole("ADMIN");
  return getCreditsReport(filter);
}

export async function getLivesReportAction(filter: LivesReportFilter) {
  await requireRole("ADMIN");
  return getLivesReport(filter);
}

export async function getStockReportAction(filter: StockReportFilter) {
  await requireRole("ADMIN");
  return getStockReport(filter);
}

export async function getTopProductsReportAction(filter: TopProductsFilter) {
  await requireRole("ADMIN");
  return getTopProductsReport(filter);
}

export async function listCategoryOptionsAction() {
  await requireRole("ADMIN");
  return listCategoryOptions();
}
