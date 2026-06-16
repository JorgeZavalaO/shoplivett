// Agregadores para el dashboard operativo. Devuelve datos agregados y
// listas cortas para que el dashboard cargue rápido y sea consistente
// con los listados existentes.

import { type OrderStatus, type ShipmentStatus } from "@prisma/client";

import { getPrisma } from "@/lib/prisma";
import type { Role } from "@/lib/permissions";
import { toCents, centsToDecimalString } from "@/lib/money";

const ZERO = "0.00";

const ACTIVE_DEBT_STATUSES: OrderStatus[] = [
  "PAYMENT_VALIDATION_PENDING",
  "RESERVED",
  "PARTIALLY_PAID",
];

const EXPIRABLE_STATUSES: OrderStatus[] = ACTIVE_DEBT_STATUSES;

const SHIPMENT_ACTIVE_STATUSES: ShipmentStatus[] = [
  "PENDING",
  "PREPARING",
  "READY",
  "SHIPPED",
];

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function endOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
}

export type DashboardPendingPayment = {
  id: string;
  amount: string;
  method: keyof typeof import("@/lib/settings-defaults").PAYMENT_METHOD_LABELS;
  createdAt: Date;
  customer: { id: string; name: string; whatsapp: string };
};

export type DashboardReservacionItem = {
  id: string;
  orderNumber: string;
  total: string;
  balance: string;
  expiresAt: Date;
  customer: { id: string; name: string; whatsapp: string };
};

export type DashboardOrderItem = {
  id: string;
  orderNumber: string;
  total: string;
  createdAt: Date;
  customer: { id: string; name: string; whatsapp: string };
};

export type DashboardShipmentItem = {
  id: string;
  status:
    | "PENDING"
    | "PREPARING"
    | "READY"
    | "SHIPPED"
    | "DELIVERED"
    | "CANCELLED";
  shippingMethod: keyof typeof import("@/lib/settings-defaults").SHIPPING_METHOD_LABELS;
  createdAt: Date;
  customer: { id: string; name: string; whatsapp: string };
  orderCount: number;
};

export type DashboardMetrics = {
  // Métricas del día
  ventasDelDiaCents: number;
  ventasDelDia: string;
  pagosValidadosDelDiaCents: number;
  pagosValidadosDelDia: string;
  pedidosDelDiaCount: number;

  // Pendientes de atención
  pagosPendientesCount: number;
  reservasPorVencerCount: number;
  reservasVencidasCount: number;

  // Totales
  deudaAcumuladaCents: number;
  deudaAcumulada: string;
  creditosDisponiblesCents: number;
  creditosDisponibles: string;

  // Operación
  pedidosListosDespachoCount: number;
  enviosEnProcesoCount: number;

  // Listas cortas
  pendingPayments: DashboardPendingPayment[];
  reservationsNearExpiry: DashboardReservacionItem[];
  ordersReadyForShipment: DashboardOrderItem[];
  shipmentsInProgress: DashboardShipmentItem[];
};

function emptyMetrics(): DashboardMetrics {
  return {
    ventasDelDiaCents: 0,
    ventasDelDia: ZERO,
    pagosValidadosDelDiaCents: 0,
    pagosValidadosDelDia: ZERO,
    pedidosDelDiaCount: 0,
    pagosPendientesCount: 0,
    reservasPorVencerCount: 0,
    reservasVencidasCount: 0,
    deudaAcumuladaCents: 0,
    deudaAcumulada: ZERO,
    creditosDisponiblesCents: 0,
    creditosDisponibles: ZERO,
    pedidosListosDespachoCount: 0,
    enviosEnProcesoCount: 0,
    pendingPayments: [],
    reservationsNearExpiry: [],
    ordersReadyForShipment: [],
    shipmentsInProgress: [],
  };
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const prisma = getPrisma();
  const now = new Date();
  const todayStart = startOfToday();
  const todayEnd = endOfToday();
  const nearExpiryThreshold = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

  const [
    ventasDelDiaAgg,
    pedidosDelDiaCount,
    pagosValidadosAgg,
    pagosPendientesCount,
    reservasVencidasCount,
    reservasPorVencerCount,
    deudaAgg,
    creditoAgg,
    pedidosListosDespachoCount,
    enviosEnProcesoCount,
    pendingPaymentsRows,
    reservationsNearExpiryRows,
    ordersReadyForShipmentRows,
    shipmentsInProgressRows,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { createdAt: { gte: todayStart, lte: todayEnd } },
      _sum: { total: true },
    }),
    prisma.order.count({
      where: { createdAt: { gte: todayStart, lte: todayEnd } },
    }),
    prisma.payment.aggregate({
      where: {
        status: "VALIDATED",
        validatedAt: { gte: todayStart, lte: todayEnd },
      },
      _sum: { amount: true },
    }),
    prisma.payment.count({ where: { status: "PENDING" } }),
    prisma.order.count({
      where: {
        expiresAt: { lt: now },
        status: { in: EXPIRABLE_STATUSES },
      },
    }),
    prisma.order.count({
      where: {
        expiresAt: { gte: now, lte: nearExpiryThreshold },
        status: { in: EXPIRABLE_STATUSES },
      },
    }),
    prisma.order.aggregate({
      where: { status: { in: ACTIVE_DEBT_STATUSES } },
      _sum: { balance: true },
    }),
    prisma.customerCredit.aggregate({
      where: {
        status: { in: ["AVAILABLE", "PARTIALLY_USED"] },
      },
      _sum: { availableAmount: true },
    }),
    prisma.order.count({
      where: {
        status: "PAID",
        shipmentOrder: null,
      },
    }),
    prisma.shipment.count({
      where: { status: { in: SHIPMENT_ACTIVE_STATUSES } },
    }),
    prisma.payment.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: 5,
      select: {
        id: true,
        amount: true,
        method: true,
        createdAt: true,
        customer: { select: { id: true, name: true, whatsapp: true } },
      },
    }),
    prisma.order.findMany({
      where: {
        expiresAt: { gte: now, lte: nearExpiryThreshold },
        status: { in: EXPIRABLE_STATUSES },
      },
      orderBy: { expiresAt: "asc" },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        total: true,
        balance: true,
        expiresAt: true,
        customer: { select: { id: true, name: true, whatsapp: true } },
      },
    }),
    prisma.order.findMany({
      where: {
        status: "PAID",
        shipmentOrder: null,
      },
      orderBy: { createdAt: "asc" },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        total: true,
        createdAt: true,
        customer: { select: { id: true, name: true, whatsapp: true } },
      },
    }),
    prisma.shipment.findMany({
      where: { status: { in: SHIPMENT_ACTIVE_STATUSES } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: {
        customer: { select: { id: true, name: true, whatsapp: true } },
        _count: { select: { orders: true } },
      },
    }),
  ]);

  const ventasDelDiaCents = toCents(ventasDelDiaAgg._sum.total);
  const pagosValidadosDelDiaCents = toCents(pagosValidadosAgg._sum.amount);
  const deudaAcumuladaCents = toCents(deudaAgg._sum.balance);
  const creditosDisponiblesCents = toCents(creditoAgg._sum.availableAmount);

  return {
    ...emptyMetrics(),
    ventasDelDiaCents,
    ventasDelDia: centsToDecimalString(ventasDelDiaCents),
    pagosValidadosDelDiaCents,
    pagosValidadosDelDia: centsToDecimalString(pagosValidadosDelDiaCents),
    pedidosDelDiaCount,
    pagosPendientesCount,
    reservasPorVencerCount,
    reservasVencidasCount,
    deudaAcumuladaCents,
    deudaAcumulada: centsToDecimalString(deudaAcumuladaCents),
    creditosDisponiblesCents,
    creditosDisponibles: centsToDecimalString(creditosDisponiblesCents),
    pedidosListosDespachoCount,
    enviosEnProcesoCount,
    pendingPayments: pendingPaymentsRows.map((p) => ({
      id: p.id,
      amount: p.amount.toString(),
      method: p.method,
      createdAt: p.createdAt,
      customer: p.customer,
    })),
    reservationsNearExpiry: reservationsNearExpiryRows.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      total: o.total.toString(),
      balance: o.balance.toString(),
      expiresAt: o.expiresAt,
      customer: o.customer,
    })),
    ordersReadyForShipment: ordersReadyForShipmentRows.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      total: o.total.toString(),
      createdAt: o.createdAt,
      customer: o.customer,
    })),
    shipmentsInProgress: shipmentsInProgressRows.map((s) => ({
      id: s.id,
      status: s.status,
      shippingMethod: s.shippingMethod,
      createdAt: s.createdAt,
      customer: s.customer,
      orderCount: s._count.orders,
    })),
  };
}

export type DashboardView = {
  role: Role;
  metrics: DashboardMetrics;
};

export async function getDashboardView(role: Role): Promise<DashboardView> {
  return { role, metrics: await getDashboardMetrics() };
}
