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
} from "@/lib/financial-reports";

function withAdminGuard<TArgs extends unknown[], TRet>(
  fn: (...args: TArgs) => TRet,
): (...args: TArgs) => Promise<TRet> {
  return async (...args: TArgs) => {
    await requireRole("ADMIN");
    return fn(...args);
  };
}

export const getSalesByMonthReportAction = withAdminGuard(getSalesByMonthReport);

export const getProductProfitabilityReportAction = withAdminGuard(
  getProductProfitabilityReport,
);

export const getBatchProfitabilityReportAction = withAdminGuard(getBatchProfitabilityReport);

export const getStockValuationReportAction = withAdminGuard(getStockValuationReport);

export const getLowRotationReportAction = withAdminGuard(getLowRotationReport);

export const getExpensesReportAction = withAdminGuard(getExpensesReport);

export const getCustomersFinancialReportAction = withAdminGuard(getCustomersFinancialReport);

export const getReturnsLossesReportAction = withAdminGuard(getReturnsLossesReport);
