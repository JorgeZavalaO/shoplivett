// Tags de invalidación para las caches del dashboard y de los reportes.
//
// Cada acción de mutación debe llamar `revalidateTag("dashboard:metrics")` (o
// el tag específico de su origen) tras commitear, para que las páginas que
// dependen de estas lecturas vuelvan a consultar la BD en la próxima request.

export const DASHBOARD_METRICS_TAG = "dashboard:metrics";
export const DASHBOARD_OVERVIEW_TAG = "dashboard:overview";
export const DASHBOARD_ALERTS_TAG = "dashboard:alerts";
export const DASHBOARD_LOW_ROTATION_TAG = "dashboard:low-rotation";
export const DASHBOARD_STOCK_VALUATION_TAG = "dashboard:stock-valuation";
export const DASHBOARD_OPEN_BATCH_CAPITAL_TAG = "dashboard:open-batch-capital";
export const DASHBOARD_BATCH_PROFITABILITY_TAG = "dashboard:batch-profitability";
export const DASHBOARD_PRODUCT_PROFITABILITY_TAG = "dashboard:product-profitability";
export const DASHBOARD_FILTERS_TAG = "dashboard:filters";
export const REPORT_SUMMARY_TAG = "report-summary";
export const SALE_CATALOG_TAG = "sale-catalog";
export const CATEGORIES_LIST_TAG = "categories:list";

/**
 * Lista consolidada de todos los tags que deben invalidarse cuando cambia
 * el dominio de pedidos. Útil para revalidar de una sola vez.
 */
export const DASHBOARD_ALL_TAGS: readonly string[] = [
  DASHBOARD_METRICS_TAG,
  DASHBOARD_OVERVIEW_TAG,
  DASHBOARD_ALERTS_TAG,
  DASHBOARD_LOW_ROTATION_TAG,
  DASHBOARD_STOCK_VALUATION_TAG,
  DASHBOARD_OPEN_BATCH_CAPITAL_TAG,
  DASHBOARD_BATCH_PROFITABILITY_TAG,
  DASHBOARD_PRODUCT_PROFITABILITY_TAG,
  DASHBOARD_FILTERS_TAG,
  REPORT_SUMMARY_TAG,
];
