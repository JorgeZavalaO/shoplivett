export {
  LOW_ROTATION_THRESHOLD_DAYS,
  DEFAULT_TOP_PRODUCTS_LIMIT,
} from "@/lib/financial-dashboard-shared";

export type {
  FinancialDashboardFilter,
  FinancialOverview,
} from "@/lib/dashboard/overview";
export { monthRange, getFinancialOverview } from "@/lib/dashboard/overview";

export type { StockValuation } from "@/lib/dashboard/stock-valuation";
export { getStockValuation } from "@/lib/dashboard/stock-valuation";

export type { OpenBatchCapital } from "@/lib/dashboard/open-batch-capital";
export { getOpenBatchCapital } from "@/lib/dashboard/open-batch-capital";

export type {
  ProductProfitabilityRow,
  ProductProfitabilityOrder,
  ProductProfitabilityFilter,
} from "@/lib/dashboard/product-profitability";
export { getProductProfitability } from "@/lib/dashboard/product-profitability";

export type { LowRotationRow } from "@/lib/dashboard/low-rotation";
export { getLowRotationProducts } from "@/lib/dashboard/low-rotation";

export type { BatchProfitabilityRow } from "@/lib/dashboard/batch-profitability";
export { getBatchProfitability } from "@/lib/dashboard/batch-profitability";

export type {
  FinancialAlert,
  FinancialAlerts,
  FinancialAlertsPrecomputed,
} from "@/lib/dashboard/alerts";
export { getFinancialAlerts } from "@/lib/dashboard/alerts";

export type { FilterOption } from "@/lib/dashboard/filters";
export {
  listBatchOptions,
  listCategoryOptionsForFilter,
  SALES_CHANNEL_FILTER_OPTIONS,
  safeSalesChannel,
  safeAllString,
  safeYearMonth,
} from "@/lib/dashboard/filters";
