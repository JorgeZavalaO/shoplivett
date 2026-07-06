import { Prisma } from "@prisma/client";

import { centsToDecimalString, type Cents } from "@/lib/money";
import { getPrisma } from "@/lib/prisma";
import {
  MAX_REPORT_ROWS,
  buildReportLimitMeta,
  resolveCents,
  safeRange,
  trimReportRows,
  type ReportDateRange,
  type ReportLimitMeta,
} from "@/lib/reports/shared/core";

export type CustomerFinancialRow = {
  customerId: string;
  customerName: string;
  whatsapp: string;
  status: string;
  ordersCount: number;
  paidOrdersCount: number;
  totalBilledCents: Cents;
  totalBilled: string;
  totalPaidCents: Cents;
  totalPaid: string;
  totalPendingCents: Cents;
  totalPending: string;
  creditAvailableCents: Cents;
  creditAvailable: string;
};

export type CustomersFinancialReport = {
  rows: CustomerFinancialRow[];
  totals: {
    customers: number;
    ordersCount: number;
    paidOrdersCount: number;
    totalBilledCents: Cents;
    totalBilled: string;
    totalPaidCents: Cents;
    totalPaid: string;
    totalPendingCents: Cents;
    totalPending: string;
    creditAvailableCents: Cents;
    creditAvailable: string;
  };
  range: ReportDateRange;
  query: string;
  meta: ReportLimitMeta;
};

export async function getCustomersFinancialReport(
  range: ReportDateRange,
  options: { query?: string } = {},
): Promise<CustomersFinancialReport> {
  const prisma = getPrisma();
  const whereRange = safeRange(range);
  const trimmed = options.query?.trim() ?? "";
  const customerWhere: Prisma.CustomerWhereInput = {
    ...(trimmed
      ? {
          OR: [
            { name: { contains: trimmed, mode: "insensitive" } },
            {
              searchName: {
                contains: trimmed.toLowerCase(),
                mode: "insensitive",
              },
            },
            { whatsapp: { contains: trimmed.replace(/\D/g, "") } },
          ],
        }
      : {}),
  };

  const orderWhere: Prisma.OrderWhereInput = {
    ...(Object.keys(whereRange).length > 0 ? { createdAt: whereRange } : {}),
  };

  const [totalRows, customersRaw] = await Promise.all([
    prisma.customer.count({ where: customerWhere }),
    prisma.customer.findMany({
      where: customerWhere,
      orderBy: { name: "asc" },
      take: MAX_REPORT_ROWS + 1,
      select: { id: true, name: true, whatsapp: true, status: true },
    }),
  ]);
  const { rows: customers, truncated } = trimReportRows(customersRaw);

  const customerIds = customers.map((c) => c.id);
  const orderGroups = customerIds.length
    ? await prisma.order.groupBy({
        by: ["customerId", "status"],
        where: { customerId: { in: customerIds }, ...orderWhere },
        _count: { _all: true },
        _sum: { total: true, validatedPaid: true, balance: true },
      })
    : [];
  const creditGroups = customerIds.length
    ? await prisma.customerCredit.groupBy({
        by: ["customerId"],
        where: {
          customerId: { in: customerIds },
          status: { in: ["AVAILABLE", "PARTIALLY_USED"] },
        },
        _sum: { availableAmount: true },
      })
    : [];

  const orderMap = new Map<
    string,
    {
      ordersCount: number;
      paidOrdersCount: number;
      total: number;
      paid: number;
      pending: number;
    }
  >();
  for (const g of orderGroups) {
    const acc = orderMap.get(g.customerId) ?? {
      ordersCount: 0,
      paidOrdersCount: 0,
      total: 0,
      paid: 0,
      pending: 0,
    };
    acc.ordersCount += g._count._all;
    acc.total += resolveCents(g._sum.total);
    acc.paid += resolveCents(g._sum.validatedPaid, true);
    acc.pending += resolveCents(g._sum.balance, true);
    if (g.status === "PAID") acc.paidOrdersCount += g._count._all;
    orderMap.set(g.customerId, acc);
  }
  const creditMap = new Map<string, number>();
  for (const g of creditGroups) {
    creditMap.set(g.customerId, resolveCents(g._sum.availableAmount, true));
  }

  const rows: CustomerFinancialRow[] = customers.map((c) => {
    const o = orderMap.get(c.id) ?? {
      ordersCount: 0,
      paidOrdersCount: 0,
      total: 0,
      paid: 0,
      pending: 0,
    };
    const credit = creditMap.get(c.id) ?? 0;
    return {
      customerId: c.id,
      customerName: c.name,
      whatsapp: c.whatsapp,
      status: c.status,
      ordersCount: o.ordersCount,
      paidOrdersCount: o.paidOrdersCount,
      totalBilledCents: o.total,
      totalBilled: centsToDecimalString(o.total),
      totalPaidCents: o.paid,
      totalPaid: centsToDecimalString(o.paid),
      totalPendingCents: o.pending,
      totalPending: centsToDecimalString(o.pending),
      creditAvailableCents: credit,
      creditAvailable: centsToDecimalString(credit),
    };
  });

  rows.sort((a, b) => b.totalBilledCents - a.totalBilledCents);

  const totals = rows.reduce(
    (acc, r) => {
      acc.customers += 1;
      acc.ordersCount += r.ordersCount;
      acc.paidOrdersCount += r.paidOrdersCount;
      acc.totalBilledCents += r.totalBilledCents;
      acc.totalPaidCents += r.totalPaidCents;
      acc.totalPendingCents += r.totalPendingCents;
      acc.creditAvailableCents += r.creditAvailableCents;
      return acc;
    },
    {
      customers: 0,
      ordersCount: 0,
      paidOrdersCount: 0,
      totalBilledCents: 0,
      totalPaidCents: 0,
      totalPendingCents: 0,
      creditAvailableCents: 0,
    },
  );

  return {
    rows,
    totals: {
      customers: totals.customers,
      ordersCount: totals.ordersCount,
      paidOrdersCount: totals.paidOrdersCount,
      totalBilledCents: totals.totalBilledCents,
      totalBilled: centsToDecimalString(totals.totalBilledCents),
      totalPaidCents: totals.totalPaidCents,
      totalPaid: centsToDecimalString(totals.totalPaidCents),
      totalPendingCents: totals.totalPendingCents,
      totalPending: centsToDecimalString(totals.totalPendingCents),
      creditAvailableCents: totals.creditAvailableCents,
      creditAvailable: centsToDecimalString(totals.creditAvailableCents),
    },
    range,
    query: trimmed,
    meta: buildReportLimitMeta(rows.length, truncated, totalRows),
  };
}
