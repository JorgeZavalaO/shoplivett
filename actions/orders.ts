"use server";

import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type OrderListItem = {
  id: string;
  orderNumber: string;
  status: string;
  total: string;
  balance: string;
  expiresAt: Date;
  createdAt: Date;
  customer: { id: string; name: string; whatsapp: string };
  liveSession: { id: string; name: string } | null;
  variantCount: number;
};

export async function listOrdersAction(args?: {
  query?: string;
  status?: string;
  page?: number;
  perPage?: number;
}) {
  await requireRole(["ADMIN", "SELLER"]);
  const safePage = Math.max(1, args?.page ?? 1);
  const safePerPage = Math.min(100, Math.max(1, args?.perPage ?? 20));
  const query = args?.query?.trim() ?? "";
  const status = args?.status ?? "ALL";

  const prisma = getPrisma();

  const where: Prisma.OrderWhereInput = {
    ...(status !== "ALL" ? { status: { equals: status } as Prisma.OrderWhereInput["status"] } : {}),
    ...(query
      ? {
          OR: [
            { orderNumber: { contains: query, mode: "insensitive" } },
            { customer: { name: { contains: query, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safePerPage,
      take: safePerPage,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        balance: true,
        expiresAt: true,
        createdAt: true,
        customer: { select: { id: true, name: true, whatsapp: true } },
        liveSession: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
    }),
  ]);

  return {
    items: items.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status as string,
      total: o.total.toString(),
      balance: o.balance.toString(),
      variantCount: o._count.items,
      expiresAt: o.expiresAt,
      createdAt: o.createdAt,
      customer: o.customer,
      liveSession: o.liveSession,
    })),
    total,
    page: safePage,
    perPage: safePerPage,
  };
}

export async function getOrderDetailAction(orderId: string) {
  await requireRole(["ADMIN", "SELLER"]);
  const prisma = getPrisma();
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      liveSession: true,
      items: {
        include: {
          variant: {
            include: { product: { include: { category: true } } },
          },
        },
      },
      payments: {
        include: { receipts: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}
