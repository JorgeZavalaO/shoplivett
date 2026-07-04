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
  if (!orderId) return null;
  const prisma = getPrisma();
  return prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      subtotal: true,
      discount: true,
      shippingAmount: true,
      total: true,
      validatedPaid: true,
      balance: true,
      expiresAt: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      salesChannel: true,
      productCostPen: true,
      grossProfitPen: true,
      paymentFeePen: true,
      packagingCostPen: true,
      netProfitPen: true,
      profitCalculatedAt: true,
      customer: {
        select: {
          id: true,
          name: true,
          whatsapp: true,
          address: true,
          district: true,
          reference: true,
          status: true,
        },
      },
      liveSession: {
        select: { id: true, name: true, channel: true, status: true },
      },
      items: {
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
          costSource: true,
          unitCostPen: true,
          totalCostPen: true,
          netLineRevenuePen: true,
          lineDiscountPen: true,
          grossProfitPen: true,
          variant: {
            select: {
              id: true,
              code: true,
              color: true,
              size: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  category: { select: { id: true, name: true } },
                },
              },
            },
          },
          allocations: {
            select: {
              id: true,
              batchId: true,
              batchItemId: true,
              quantity: true,
              unitCostPen: true,
              subtotalCostPen: true,
              createdAt: true,
            },
          },
        },
      },
      payments: {
        select: {
          id: true,
          method: true,
          status: true,
          amount: true,
          operationNumber: true,
          notes: true,
          validatedAt: true,
          createdAt: true,
          receipts: {
            select: { id: true, createdAt: true },
          },
          applications: {
            select: {
              id: true,
              amount: true,
              createdAt: true,
              order: { select: { id: true, orderNumber: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      shipmentOrders: {
        where: { shipment: { status: { not: "CANCELLED" } } },
        take: 1,
        select: {
          id: true,
          shipment: { select: { id: true, status: true } },
        },
      },
    },
  });
}
