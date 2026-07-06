// Capa de agregadores para los reportes del Sprint 13.
// Todas las consultas usan select mínimos y, cuando aplica, agregaciones
// server-side. Los totales monetarios se devuelven en centavos (`Cents`) y
// en string decimal (`toCents` / `centsToDecimalString`).

import {
  Prisma,
  type CreditStatus,
  type LiveStatus,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
} from "@prisma/client";

import { getPrisma } from "@/lib/prisma";
import { centsToDecimalString, toCents, type Cents } from "@/lib/money";

const ZERO = "0.00";

function empty<T>(v: T | null | undefined, fallback: T): T {
  return v === null || v === undefined ? fallback : v;
}

function range(from: Date | null, to: Date | null): { gte?: Date; lte?: Date } {
  const out: { gte?: Date; lte?: Date } = {};
  if (from) out.gte = from;
  if (to) out.lte = to;
  return out;
}

export type ReportRange = { from: Date | null; to: Date | null };

export type ReportSummary = {
  ventasCents: Cents;
  ventas: string;
  cobrosValidadosCents: Cents;
  cobrosValidados: string;
  pedidosCount: number;
  pagosCount: number;
  deudaActivaCents: Cents;
  deudaActiva: string;
  creditoDisponibleCents: Cents;
  creditoDisponible: string;
  reservasVencidasCount: number;
};

function emptySummary(): ReportSummary {
  return {
    ventasCents: 0,
    ventas: ZERO,
    cobrosValidadosCents: 0,
    cobrosValidados: ZERO,
    pedidosCount: 0,
    pagosCount: 0,
    deudaActivaCents: 0,
    deudaActiva: ZERO,
    creditoDisponibleCents: 0,
    creditoDisponible: ZERO,
    reservasVencidasCount: 0,
  };
}

export async function getReportSummary(filter: ReportRange): Promise<ReportSummary> {
  const prisma = getPrisma();
  const orderRange = range(filter.from, filter.to);
  const paymentRange = range(filter.from, filter.to);
  const now = new Date();

  const [
    ventasAgg,
    pedidosCount,
    cobrosAgg,
    pagosCount,
    deudaAgg,
    creditoAgg,
    reservasVencidas,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { createdAt: orderRange },
      _sum: { total: true },
    }),
    prisma.order.count({ where: { createdAt: orderRange } }),
    prisma.payment.aggregate({
      where: { status: "VALIDATED", validatedAt: paymentRange },
      _sum: { amount: true },
    }),
    prisma.payment.count({
      where: { status: "VALIDATED", validatedAt: paymentRange },
    }),
    prisma.order.aggregate({
      where: {
        status: {
          in: [
            "PAYMENT_VALIDATION_PENDING",
            "RESERVED",
            "PARTIALLY_PAID",
          ] satisfies OrderStatus[],
        },
      },
      _sum: { balance: true },
    }),
    prisma.customerCredit.aggregate({
      where: {
        status: {
          in: ["AVAILABLE", "PARTIALLY_USED"] satisfies CreditStatus[],
        },
      },
      _sum: { availableAmount: true },
    }),
    prisma.order.count({
      where: {
        status: {
          in: [
            "PAYMENT_VALIDATION_PENDING",
            "RESERVED",
            "PARTIALLY_PAID",
          ] satisfies OrderStatus[],
        },
        expiresAt: { lt: now },
      },
    }),
  ]);

  const ventasCents = toCents(ventasAgg._sum.total);
  const cobrosCents = toCents(cobrosAgg._sum.amount);
  const deudaCents = toCents(deudaAgg._sum.balance);
  const creditoCents = toCents(creditoAgg._sum.availableAmount);

  return {
    ventasCents,
    ventas: centsToDecimalString(ventasCents),
    cobrosValidadosCents: cobrosCents,
    cobrosValidados: centsToDecimalString(cobrosCents),
    pedidosCount,
    pagosCount,
    deudaActivaCents: deudaCents,
    deudaActiva: centsToDecimalString(deudaCents),
    creditoDisponibleCents: creditoCents,
    creditoDisponible: centsToDecimalString(creditoCents),
    reservasVencidasCount: reservasVencidas,
  };
}

export type PaymentReportItem = {
  id: string;
  status: PaymentStatus;
  method: PaymentMethod;
  amount: string;
  operationNumber: string | null;
  createdAt: Date;
  validatedAt: Date | null;
  customer: { id: string; name: string; whatsapp: string };
};

export type PaymentsReport = {
  items: PaymentReportItem[];
  total: number;
  page: number;
  perPage: number;
  byMethod: Array<{ method: PaymentMethod; amount: string; count: number }>;
  byStatus: Array<{ status: PaymentStatus; amount: string; count: number }>;
};

export type PaymentsReportFilter = ReportRange & {
  method?: PaymentMethod | "ALL";
  status?: PaymentStatus | "ALL";
  query?: string;
  page?: number;
  perPage?: number;
};

const PAYMENT_METHOD_VALUES: PaymentMethod[] = ["YAPE", "PLIN", "CASH", "OTHER"];
const PAYMENT_STATUS_VALUES: PaymentStatus[] = ["PENDING", "VALIDATED", "REJECTED"];

export async function getPaymentsReport(filter: PaymentsReportFilter): Promise<PaymentsReport> {
  const prisma = getPrisma();
  const safePage = Math.max(1, filter.page ?? 1);
  const safePerPage = Math.min(100, Math.max(1, filter.perPage ?? 20));
  const method = filter.method && filter.method !== "ALL" ? filter.method : undefined;
  const status = filter.status && filter.status !== "ALL" ? filter.status : undefined;
  const trimmed = filter.query?.trim() ?? "";
  const createdAt = range(filter.from, filter.to);

  const where: Prisma.PaymentWhereInput = {
    ...(method ? { method } : {}),
    ...(status ? { status } : {}),
    ...(Object.keys(createdAt).length > 0 ? { createdAt } : {}),
    ...(trimmed
      ? {
          OR: [
            { operationNumber: { contains: trimmed, mode: "insensitive" } },
            { customer: { name: { contains: trimmed, mode: "insensitive" } } },
            {
              customer: {
                whatsapp: { contains: trimmed.replace(/\D/g, "") },
              },
            },
          ],
        }
      : {}),
  };

  const [total, rows, byMethodRows, byStatusRows] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safePerPage,
      take: safePerPage,
      select: {
        id: true,
        status: true,
        method: true,
        amount: true,
        operationNumber: true,
        createdAt: true,
        validatedAt: true,
        customer: { select: { id: true, name: true, whatsapp: true } },
      },
    }),
    prisma.payment.groupBy({
      where,
      by: ["method"],
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.payment.groupBy({
      where,
      by: ["status"],
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const methodBase = new Map<PaymentMethod, { amount: Cents; count: number }>();
  for (const m of PAYMENT_METHOD_VALUES) methodBase.set(m, { amount: 0, count: 0 });
  for (const row of byMethodRows) {
    methodBase.set(row.method, {
      amount: toCents(row._sum.amount, { allowNegative: true }),
      count: row._count._all,
    });
  }
  const statusBase = new Map<PaymentStatus, { amount: Cents; count: number }>();
  for (const s of PAYMENT_STATUS_VALUES) statusBase.set(s, { amount: 0, count: 0 });
  for (const row of byStatusRows) {
    statusBase.set(row.status, {
      amount: toCents(row._sum.amount, { allowNegative: true }),
      count: row._count._all,
    });
  }

  return {
    items: rows.map((p) => ({
      id: p.id,
      status: p.status,
      method: p.method,
      amount: p.amount.toString(),
      operationNumber: p.operationNumber,
      createdAt: p.createdAt,
      validatedAt: p.validatedAt,
      customer: p.customer,
    })),
    total,
    page: safePage,
    perPage: safePerPage,
    byMethod: Array.from(methodBase.entries()).map(([m, v]) => ({
      method: m,
      amount: centsToDecimalString(v.amount),
      count: v.count,
    })),
    byStatus: Array.from(statusBase.entries()).map(([s, v]) => ({
      status: s,
      amount: centsToDecimalString(v.amount),
      count: v.count,
    })),
  };
}

export type PendingBalanceRow = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  total: string;
  validatedPaid: string;
  balance: string;
  expiresAt: Date;
  createdAt: Date;
  customer: { id: string; name: string; whatsapp: string };
};

export type PendingBalancesReport = {
  items: PendingBalanceRow[];
  total: number;
  page: number;
  perPage: number;
  totalBalanceCents: Cents;
  totalBalance: string;
  byCustomer: Array<{
    customerId: string;
    customerName: string;
    balance: string;
    ordersCount: number;
  }>;
};

export type PendingBalancesFilter = ReportRange & {
  query?: string;
  page?: number;
  perPage?: number;
};

const PENDING_STATUSES: OrderStatus[] = [
  "PAYMENT_VALIDATION_PENDING",
  "RESERVED",
  "PARTIALLY_PAID",
];

export async function getPendingBalancesReport(
  filter: PendingBalancesFilter,
): Promise<PendingBalancesReport> {
  const prisma = getPrisma();
  const safePage = Math.max(1, filter.page ?? 1);
  const safePerPage = Math.min(100, Math.max(1, filter.perPage ?? 20));
  const trimmed = filter.query?.trim() ?? "";
  const createdAt = range(filter.from, filter.to);

  const baseWhere: Prisma.OrderWhereInput = {
    status: { in: PENDING_STATUSES },
    ...(Object.keys(createdAt).length > 0 ? { createdAt } : {}),
  };

  const where: Prisma.OrderWhereInput = {
    ...baseWhere,
    ...(trimmed
      ? {
          OR: [
            { orderNumber: { contains: trimmed, mode: "insensitive" } },
            { customer: { name: { contains: trimmed, mode: "insensitive" } } },
            {
              customer: {
                whatsapp: { contains: trimmed.replace(/\D/g, "") },
              },
            },
          ],
        }
      : {}),
  };

  const [total, items, aggregate, byCustomer] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: [{ balance: "desc" }, { createdAt: "asc" }],
      skip: (safePage - 1) * safePerPage,
      take: safePerPage,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        validatedPaid: true,
        balance: true,
        expiresAt: true,
        createdAt: true,
        customer: { select: { id: true, name: true, whatsapp: true } },
      },
    }),
    prisma.order.aggregate({
      where,
      _sum: { balance: true },
    }),
    prisma.order.groupBy({
      by: ["customerId"],
      where: baseWhere,
      _sum: { balance: true },
      _count: { _all: true },
      orderBy: { _sum: { balance: "desc" } },
      take: 10,
    }),
  ]);

  let byCustomerWithNames: PendingBalancesReport["byCustomer"] = [];
  if (byCustomer.length > 0) {
    const ids = byCustomer.map((c) => c.customerId);
    const customers = await prisma.customer.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(customers.map((c) => [c.id, c.name]));
    byCustomerWithNames = byCustomer.map((c) => ({
      customerId: c.customerId,
      customerName: nameMap.get(c.customerId) ?? "—",
      balance: centsToDecimalString(
        toCents(c._sum.balance, { allowNegative: true }),
      ),
      ordersCount: c._count._all,
    }));
  }

  const totalBalanceCents = toCents(aggregate._sum.balance, {
    allowNegative: true,
  });

  return {
    items: items.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      total: o.total.toString(),
      validatedPaid: o.validatedPaid.toString(),
      balance: o.balance.toString(),
      expiresAt: o.expiresAt,
      createdAt: o.createdAt,
      customer: o.customer,
    })),
    total,
    page: safePage,
    perPage: safePerPage,
    totalBalanceCents,
    totalBalance: centsToDecimalString(totalBalanceCents),
    byCustomer: byCustomerWithNames,
  };
}

export type CreditReportItem = {
  id: string;
  origin: "OVERPAYMENT" | "MANUAL" | "REFUND";
  status: CreditStatus;
  amount: string;
  availableAmount: string;
  notes: string | null;
  createdAt: Date;
  customer: { id: string; name: string; whatsapp: string };
  payment: { id: string; method: PaymentMethod; amount: string } | null;
};

export type CreditsReport = {
  items: CreditReportItem[];
  total: number;
  page: number;
  perPage: number;
  byStatus: Array<{ status: CreditStatus; amount: string; count: number }>;
  byOrigin: Array<{ origin: "OVERPAYMENT" | "MANUAL" | "REFUND"; amount: string; count: number }>;
};

export type CreditsReportFilter = ReportRange & {
  status?: CreditStatus | "ALL";
  origin?: "OVERPAYMENT" | "MANUAL" | "REFUND" | "ALL";
  query?: string;
  page?: number;
  perPage?: number;
};

const CREDIT_STATUS_VALUES: CreditStatus[] = [
  "AVAILABLE",
  "PARTIALLY_USED",
  "USED",
  "REFUNDED",
  "VOIDED",
];

const CREDIT_ORIGIN_VALUES = ["OVERPAYMENT", "MANUAL", "REFUND"] as const;

export async function getCreditsReport(
  filter: CreditsReportFilter,
): Promise<CreditsReport> {
  const prisma = getPrisma();
  const safePage = Math.max(1, filter.page ?? 1);
  const safePerPage = Math.min(100, Math.max(1, filter.perPage ?? 20));
  const status = filter.status && filter.status !== "ALL" ? filter.status : undefined;
  const origin = filter.origin && filter.origin !== "ALL" ? filter.origin : undefined;
  const trimmed = filter.query?.trim() ?? "";
  const createdAt = range(filter.from, filter.to);

  const where: Prisma.CustomerCreditWhereInput = {
    ...(status ? { status } : {}),
    ...(origin ? { origin } : {}),
    ...(Object.keys(createdAt).length > 0 ? { createdAt } : {}),
    ...(trimmed
      ? {
          OR: [
            { customer: { name: { contains: trimmed, mode: "insensitive" } } },
            {
              customer: {
                whatsapp: { contains: trimmed.replace(/\D/g, "") },
              },
            },
            { notes: { contains: trimmed, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, items, byStatusRows, byOriginRows] = await Promise.all([
    prisma.customerCredit.count({ where }),
    prisma.customerCredit.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safePerPage,
      take: safePerPage,
      select: {
        id: true,
        origin: true,
        status: true,
        amount: true,
        availableAmount: true,
        notes: true,
        createdAt: true,
        customer: { select: { id: true, name: true, whatsapp: true } },
        payment: {
          select: { id: true, method: true, amount: true },
        },
      },
    }),
    prisma.customerCredit.groupBy({
      where,
      by: ["status"],
      _sum: { availableAmount: true, amount: true },
      _count: { _all: true },
    }),
    prisma.customerCredit.groupBy({
      where,
      by: ["origin"],
      _sum: { amount: true, availableAmount: true },
      _count: { _all: true },
    }),
  ]);

  const statusBase = new Map<CreditStatus, { amount: Cents; count: number }>();
  for (const s of CREDIT_STATUS_VALUES) statusBase.set(s, { amount: 0, count: 0 });
  for (const row of byStatusRows) {
    statusBase.set(row.status, {
      amount: toCents(
        row.status === "AVAILABLE" || row.status === "PARTIALLY_USED"
          ? row._sum.availableAmount
          : row._sum.amount,
        { allowNegative: true },
      ),
      count: row._count._all,
    });
  }

  const originBase = new Map<
    (typeof CREDIT_ORIGIN_VALUES)[number],
    { amount: Cents; count: number }
  >();
  for (const o of CREDIT_ORIGIN_VALUES) originBase.set(o, { amount: 0, count: 0 });
  for (const row of byOriginRows) {
    originBase.set(row.origin, {
      amount: toCents(row._sum.amount, { allowNegative: true }),
      count: row._count._all,
    });
  }

  return {
    items: items.map((c) => ({
      id: c.id,
      origin: c.origin,
      status: c.status,
      amount: c.amount.toString(),
      availableAmount: c.availableAmount.toString(),
      notes: c.notes,
      createdAt: c.createdAt,
      customer: c.customer,
      payment: c.payment
        ? {
            id: c.payment.id,
            method: c.payment.method,
            amount: c.payment.amount.toString(),
          }
        : null,
    })),
    total,
    page: safePage,
    perPage: safePerPage,
    byStatus: Array.from(statusBase.entries()).map(([s, v]) => ({
      status: s,
      amount: centsToDecimalString(v.amount),
      count: v.count,
    })),
    byOrigin: Array.from(originBase.entries()).map(([o, v]) => ({
      origin: o,
      amount: centsToDecimalString(v.amount),
      count: v.count,
    })),
  };
}

export type LiveSalesRow = {
  id: string;
  name: string;
  channel: string;
  status: LiveStatus;
  startedAt: Date;
  closedAt: Date | null;
  ordersCount: number;
  pedidosTotal: string;
  cobradoTotal: string;
  pendienteTotal: string;
};

export type LivesReport = {
  items: LiveSalesRow[];
  total: number;
  page: number;
  perPage: number;
  totals: {
    ordersCount: number;
    pedidosTotal: string;
    cobradoTotal: string;
    pendienteTotal: string;
  };
};

export type LivesReportFilter = ReportRange & {
  status?: LiveStatus | "ALL";
  query?: string;
  page?: number;
  perPage?: number;
};

const LIVE_STATUS_VALUES: LiveStatus[] = ["OPEN", "CLOSED", "CANCELLED"];

export async function getLivesReport(filter: LivesReportFilter): Promise<LivesReport> {
  const prisma = getPrisma();
  const safePage = Math.max(1, filter.page ?? 1);
  const safePerPage = Math.min(100, Math.max(1, filter.perPage ?? 20));
  const status = filter.status && filter.status !== "ALL" ? filter.status : undefined;
  const trimmed = filter.query?.trim() ?? "";
  const startedAt = range(filter.from, filter.to);

  const where: Prisma.LiveSessionWhereInput = {
    ...(status ? { status } : {}),
    ...(Object.keys(startedAt).length > 0 ? { startedAt } : {}),
    ...(trimmed
      ? { name: { contains: trimmed, mode: "insensitive" } }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.liveSession.count({ where }),
    prisma.liveSession.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip: (safePage - 1) * safePerPage,
      take: safePerPage,
      select: {
        id: true,
        name: true,
        channel: true,
        status: true,
        startedAt: true,
        closedAt: true,
        _count: { select: { orders: true } },
      },
    }),
  ]);

  const liveIds = items.map((i) => i.id);
  const metricsByLive = new Map<
    string,
    { pedidos: Cents; cobrado: Cents; pendiente: Cents }
  >();
  if (liveIds.length > 0) {
    const paidLikeStatuses: OrderStatus[] = ["PAID", "PARTIALLY_PAID", "RESERVED"];
    const [ordersByLive, paidLikeByLive, pendingByLive] = await Promise.all([
      prisma.order.groupBy({
        by: ["liveSessionId"],
        where: { liveSessionId: { in: liveIds } },
        _sum: { total: true },
      }),
      prisma.order.groupBy({
        by: ["liveSessionId"],
        where: {
          liveSessionId: { in: liveIds },
          status: { in: paidLikeStatuses },
        },
        _sum: { validatedPaid: true, balance: true },
      }),
      prisma.order.groupBy({
        by: ["liveSessionId"],
        where: {
          liveSessionId: { in: liveIds },
          status: "PAYMENT_VALIDATION_PENDING",
        },
        _sum: { total: true },
      }),
    ]);

    const ordersMap = new Map(
      ordersByLive
        .filter((row) => row.liveSessionId !== null)
        .map((row) => [row.liveSessionId as string, row]),
    );
    const paidLikeMap = new Map(
      paidLikeByLive
        .filter((row) => row.liveSessionId !== null)
        .map((row) => [row.liveSessionId as string, row]),
    );
    const pendingMap = new Map(
      pendingByLive
        .filter((row) => row.liveSessionId !== null)
        .map((row) => [row.liveSessionId as string, row]),
    );

    for (const id of liveIds) {
      const orders = ordersMap.get(id);
      const paidLike = paidLikeMap.get(id);
      const pending = pendingMap.get(id);
      metricsByLive.set(id, {
        pedidos: toCents(orders?._sum.total, { allowNegative: true }),
        cobrado: toCents(paidLike?._sum.validatedPaid, { allowNegative: true }),
        pendiente:
          toCents(paidLike?._sum.balance, { allowNegative: true }) +
          toCents(pending?._sum.total, { allowNegative: true }),
      });
    }
  }

  let ordersCount = 0;
  let pedidosCents: Cents = 0;
  let cobradoCents: Cents = 0;
  let pendienteCents: Cents = 0;
  const rows: LiveSalesRow[] = items.map((live) => {
    const m = metricsByLive.get(live.id) ?? {
      pedidos: 0,
      cobrado: 0,
      pendiente: 0,
    };
    ordersCount += live._count.orders;
    pedidosCents += m.pedidos;
    cobradoCents += m.cobrado;
    pendienteCents += m.pendiente;
    return {
      id: live.id,
      name: live.name,
      channel: live.channel,
      status: live.status,
      startedAt: live.startedAt,
      closedAt: live.closedAt,
      ordersCount: live._count.orders,
      pedidosTotal: centsToDecimalString(m.pedidos),
      cobradoTotal: centsToDecimalString(m.cobrado),
      pendienteTotal: centsToDecimalString(m.pendiente),
    };
  });

  return {
    items: rows,
    total,
    page: safePage,
    perPage: safePerPage,
    totals: {
      ordersCount,
      pedidosTotal: centsToDecimalString(pedidosCents),
      cobradoTotal: centsToDecimalString(cobradoCents),
      pendienteTotal: centsToDecimalString(pendienteCents),
    },
  };
}

export type StockReportRow = {
  id: string;
  code: string;
  color: string | null;
  size: string | null;
  status: "ACTIVE" | "HIDDEN" | "ARCHIVED";
  stock: number;
  reservedStock: number;
  soldStock: number;
  available: number;
  product: {
    id: string;
    name: string;
    category: { id: string; name: string };
  };
};

export type StockReport = {
  items: StockReportRow[];
  total: number;
  page: number;
  perPage: number;
  totals: {
    stock: number;
    reserved: number;
    sold: number;
    available: number;
  };
};

export type StockReportFilter = {
  query?: string;
  categoryId?: string;
  page?: number;
  perPage?: number;
};

export async function getStockReport(filter: StockReportFilter): Promise<StockReport> {
  const prisma = getPrisma();
  const safePage = Math.max(1, filter.page ?? 1);
  const safePerPage = Math.min(100, Math.max(1, filter.perPage ?? 20));
  const trimmed = filter.query?.trim() ?? "";
  const categoryId = filter.categoryId?.trim() || undefined;

  const where: Prisma.ProductVariantWhereInput = {
    ...(categoryId ? { product: { categoryId } } : {}),
    ...(trimmed
      ? {
          OR: [
            { code: { contains: trimmed, mode: "insensitive" } },
            { product: { name: { contains: trimmed, mode: "insensitive" } } },
            { color: { contains: trimmed, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, items, agg] = await Promise.all([
    prisma.productVariant.count({ where }),
    prisma.productVariant.findMany({
      where,
      orderBy: [{ product: { name: "asc" } }, { code: "asc" }],
      skip: (safePage - 1) * safePerPage,
      take: safePerPage,
      select: {
        id: true,
        code: true,
        color: true,
        size: true,
        status: true,
        stock: true,
        reservedStock: true,
        soldStock: true,
        product: {
          select: {
            id: true,
            name: true,
            category: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.productVariant.aggregate({
      where,
      _sum: { stock: true, reservedStock: true, soldStock: true },
    }),
  ]);

  const rows: StockReportRow[] = items.map((v) => ({
    id: v.id,
    code: v.code,
    color: v.color,
    size: v.size,
    status: v.status,
    stock: v.stock,
    reservedStock: v.reservedStock,
    soldStock: v.soldStock,
    available: Math.max(0, v.stock - v.reservedStock - v.soldStock),
    product: v.product,
  }));

  const stock = agg._sum.stock ?? 0;
  const reserved = agg._sum.reservedStock ?? 0;
  const sold = agg._sum.soldStock ?? 0;
  const available = Math.max(0, stock - reserved - sold);

  return {
    items: rows,
    total,
    page: safePage,
    perPage: safePerPage,
    totals: { stock, reserved, sold, available },
  };
}

export type TopProductRow = {
  variantId: string;
  code: string;
  productName: string;
  categoryName: string;
  color: string | null;
  size: string | null;
  unitsSold: number;
  revenueCents: Cents;
  revenue: string;
  stock: number;
  available: number;
};

export type TopProductsReport = {
  items: TopProductRow[];
  totals: {
    unitsSold: number;
    revenueCents: Cents;
    revenue: string;
  };
};

export type TopProductsFilter = ReportRange & {
  limit?: number;
  categoryId?: string;
};

export async function getTopProductsReport(
  filter: TopProductsFilter,
): Promise<TopProductsReport> {
  const prisma = getPrisma();
  const limit = Math.min(50, Math.max(1, filter.limit ?? 20));
  const createdAt = range(filter.from, filter.to);
  const categoryId = filter.categoryId?.trim() || undefined;

  const hasRange = Object.keys(createdAt).length > 0;

  if (!hasRange) {
    const aggregated = await prisma.orderItem.groupBy({
      by: ["variantId"],
      where: {
        ...(categoryId ? { variant: { product: { categoryId } } } : {}),
      },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: limit,
    });

    const variantIds = aggregated.map((a) => a.variantId);
    const variantRows = variantIds.length
      ? await prisma.productVariant.findMany({
          where: { id: { in: variantIds } },
          select: {
            id: true,
            code: true,
            color: true,
            size: true,
            stock: true,
            reservedStock: true,
            soldStock: true,
            product: {
              select: {
                name: true,
                category: { select: { name: true } },
              },
            },
          },
        })
      : [];
    const variantMap = new Map(variantRows.map((v) => [v.id, v]));

    let totalUnits = 0;
    let totalRevenueCents: Cents = 0;
    const rows: TopProductRow[] = aggregated.map((row) => {
      const variant = variantMap.get(row.variantId);
      const units = row._sum.quantity ?? 0;
      const revenueCents = toCents(row._sum.lineTotal, { allowNegative: true });
      totalUnits += units;
      totalRevenueCents += revenueCents;
      return {
        variantId: row.variantId,
        code: variant?.code ?? "—",
        productName: variant?.product.name ?? "—",
        categoryName: variant?.product.category.name ?? "—",
        color: variant?.color ?? null,
        size: variant?.size ?? null,
        unitsSold: units,
        revenueCents,
        revenue: centsToDecimalString(revenueCents),
        stock: variant?.stock ?? 0,
        available: variant
          ? Math.max(0, variant.stock - variant.reservedStock - variant.soldStock)
          : 0,
      };
    });

    return {
      items: rows,
      totals: {
        unitsSold: totalUnits,
        revenueCents: totalRevenueCents,
        revenue: centsToDecimalString(totalRevenueCents),
      },
    };
  }

  const aggregated = await prisma.orderItem.groupBy({
    by: ["variantId"],
    where: {
      ...(categoryId ? { variant: { product: { categoryId } } } : {}),
      order: { createdAt: createdAt },
    },
    _sum: { quantity: true, lineTotal: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit,
  });

  const variantIds = aggregated.map((a) => a.variantId);
  const variantRows = variantIds.length
    ? await prisma.productVariant.findMany({
        where: { id: { in: variantIds } },
        select: {
          id: true,
          code: true,
          color: true,
          size: true,
          stock: true,
          reservedStock: true,
          soldStock: true,
          product: {
            select: {
              name: true,
              category: { select: { name: true } },
            },
          },
        },
      })
    : [];
  const variantMap = new Map(variantRows.map((v) => [v.id, v]));

  let totalUnits = 0;
  let totalRevenueCents: Cents = 0;
  const rows: TopProductRow[] = aggregated.map((row) => {
    const variant = variantMap.get(row.variantId);
    const units = row._sum.quantity ?? 0;
    const revenueCents = toCents(row._sum.lineTotal, { allowNegative: true });
    totalUnits += units;
    totalRevenueCents += revenueCents;
    return {
      variantId: row.variantId,
      code: variant?.code ?? "—",
      productName: variant?.product.name ?? "—",
      categoryName: variant?.product.category.name ?? "—",
      color: variant?.color ?? null,
      size: variant?.size ?? null,
      unitsSold: units,
      revenueCents,
      revenue: centsToDecimalString(revenueCents),
      stock: variant?.stock ?? 0,
      available: variant
        ? Math.max(0, variant.stock - variant.reservedStock - variant.soldStock)
        : 0,
    };
  });

  return {
    items: rows,
    totals: {
      unitsSold: totalUnits,
      revenueCents: totalRevenueCents,
      revenue: centsToDecimalString(totalRevenueCents),
    },
  };
}

export type CategoryOption = { id: string; name: string };

export async function listCategoryOptions(): Promise<CategoryOption[]> {
  const prisma = getPrisma();
  const rows = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return rows;
}

export function emptySummaryReport(): ReportSummary {
  return emptySummary();
}

export { empty as emptyValue, PAYMENT_METHOD_VALUES, PAYMENT_STATUS_VALUES, LIVE_STATUS_VALUES, CREDIT_STATUS_VALUES, CREDIT_ORIGIN_VALUES };
