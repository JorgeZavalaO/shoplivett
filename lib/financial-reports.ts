import { SalesChannel } from "@prisma/client";

import { SALES_CHANNEL_LABELS } from "@/lib/settings-defaults";

export { MAX_REPORT_ROWS } from "@/lib/reports/shared/core";
export type {
  ReportDateRange,
  ReportLimitMeta,
} from "@/lib/reports/shared/core";

export type {
  SalesByMonthRow,
  SalesByMonthReport,
} from "@/lib/reports/sales";
export { getSalesByMonthReport } from "@/lib/reports/sales";

export type {
  ProductProfitabilityRow,
  ProductProfitabilityReport,
} from "@/lib/reports/products";
export { getProductProfitabilityReport } from "@/lib/reports/products";

export type {
  BatchProfitabilityRow,
  BatchProfitabilityReport,
} from "@/lib/reports/batches";
export { getBatchProfitabilityReport } from "@/lib/reports/batches";

export type {
  StockValuationRow,
  StockValuationReport,
} from "@/lib/reports/stock";
export { getStockValuationReport } from "@/lib/reports/stock";

export type { LowRotationRow, LowRotationReport } from "@/lib/reports/rotation";
export { getLowRotationReport } from "@/lib/reports/rotation";

export type {
  FinancialExpensesRow,
  FinancialExpensesReport,
} from "@/lib/reports/expenses";
export { getExpensesReport } from "@/lib/reports/expenses";

export type {
  CustomerFinancialRow,
  CustomersFinancialReport,
} from "@/lib/reports/customers";
export { getCustomersFinancialReport } from "@/lib/reports/customers";

export type {
  ReturnsLossesRow,
  ReturnsLossesReport,
} from "@/lib/reports/returns";
export { getReturnsLossesReport } from "@/lib/reports/returns";

export function channelLabel(value: string): string {
  return SALES_CHANNEL_LABELS[value as SalesChannel] ?? value;
}
