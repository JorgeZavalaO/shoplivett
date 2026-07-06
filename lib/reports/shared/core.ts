import { toCents, type Cents } from "@/lib/money";

export const ZERO = "0.00";
export const MAX_REPORT_ROWS = 5000;

export type ReportDateRange = { from: Date | null; to: Date | null };

export type ReportLimitMeta = {
  limit: number;
  returnedRows: number;
  truncated: boolean;
  totalRows?: number;
};

export function safeRange(
  range: ReportDateRange,
): { gte?: Date; lte?: Date } {
  const out: { gte?: Date; lte?: Date } = {};
  if (range.from) out.gte = range.from;
  if (range.to) out.lte = range.to;
  return out;
}

export function resolveCents(
  value: string | number | { toString(): string } | null | undefined,
  allowNegative = false,
): Cents {
  return toCents(value, { allowNegative });
}

export function trimReportRows<T>(rows: T[], limit = MAX_REPORT_ROWS) {
  const truncated = rows.length > limit;
  return {
    rows: truncated ? rows.slice(0, limit) : rows,
    truncated,
  };
}

export function buildReportLimitMeta(
  returnedRows: number,
  truncated: boolean,
  totalRows?: number,
): ReportLimitMeta {
  return {
    limit: MAX_REPORT_ROWS,
    returnedRows,
    truncated,
    ...(typeof totalRows === "number" ? { totalRows } : {}),
  };
}
