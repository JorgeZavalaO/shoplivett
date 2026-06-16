// Lógica de reservas vencidas. Lista pedidos cuya fecha de expiración ya pasó
// y permite cancelarlos manualmente liberando el stock reservado.

import { Prisma, OrderStatus } from "@prisma/client";

import { getPrisma } from "@/lib/prisma";
import { releaseStock } from "@/lib/inventory";

export class OrderExpiryError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "ORDER_NOT_FOUND"
      | "ORDER_NOT_EXPIRED"
      | "ORDER_NOT_CANCELLABLE"
      | "ALREADY_EXPIRED"
      | "CONFLICT",
  ) {
    super(message);
    this.name = "OrderExpiryError";
  }
}

// Solo se pueden vencer pedidos que aún no han recibido dinero validado.
// Un pedido PARTIALLY_PAID tiene pagos validados y/o créditos aplicados; para
// cerrarlo se requiere intervención manual (devolución/anulación de pagos o
// nueva venta) en lugar de una expiración automática.
const EXPIRABLE_STATUSES: OrderStatus[] = [
  "PAYMENT_VALIDATION_PENDING",
  "RESERVED",
];

export async function listExpiredReservations(args?: {
  query?: string;
  page?: number;
  perPage?: number;
}) {
  const prisma = getPrisma();
  const now = new Date();
  const safePage = Math.max(1, args?.page ?? 1);
  const safePerPage = Math.min(100, Math.max(1, args?.perPage ?? 20));
  const query = args?.query?.trim() ?? "";

  const where: Prisma.OrderWhereInput = {
    expiresAt: { lt: now },
    status: { in: EXPIRABLE_STATUSES },
    ...(query
      ? {
          OR: [
            { orderNumber: { contains: query, mode: "insensitive" } },
            { customer: { name: { contains: query, mode: "insensitive" } } },
            { customer: { whatsapp: { contains: query.replace(/\D/g, "") } } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { expiresAt: "asc" },
      skip: (safePage - 1) * safePerPage,
      take: safePerPage,
      include: {
        customer: { select: { id: true, name: true, whatsapp: true } },
        items: { select: { variantId: true, quantity: true } },
      },
    }),
  ]);

  return {
    items: items.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      total: o.total.toString(),
      balance: o.balance.toString(),
      expiresAt: o.expiresAt,
      createdAt: o.createdAt,
      customer: o.customer,
      itemCount: o.items.length,
      totalUnits: o.items.reduce((acc, i) => acc + i.quantity, 0),
    })),
    total,
    page: safePage,
    perPage: safePerPage,
    query,
  };
}

export async function listReservationsNearExpiry(args?: { days?: number }) {
  const prisma = getPrisma();
  const now = new Date();
  const days = Math.max(1, args?.days ?? 2);
  const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return prisma.order.findMany({
    where: {
      expiresAt: { gte: now, lte: future },
      status: { in: EXPIRABLE_STATUSES },
    },
    orderBy: { expiresAt: "asc" },
    take: 20,
    include: {
      customer: { select: { id: true, name: true, whatsapp: true } },
    },
  });
}

export async function expireReservation(input: {
  orderId: string;
  expiredById?: string | null;
  reason?: string | null;
}): Promise<{ orderId: string; releasedUnits: number }> {
  const prisma = getPrisma();
  try {
    return await prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: input.orderId },
          include: {
            items: { select: { variantId: true, quantity: true } },
            payments: { where: { status: "PENDING" }, select: { id: true } },
          },
        });
        if (!order) {
          throw new OrderExpiryError("El pedido ya no existe.", "ORDER_NOT_FOUND");
        }
        if (order.status === "EXPIRED") {
          throw new OrderExpiryError("El pedido ya está vencido.", "ALREADY_EXPIRED");
        }
        if (order.status === "CANCELLED") {
          throw new OrderExpiryError("El pedido está cancelado.", "ORDER_NOT_CANCELLABLE");
        }
        if (order.status === "PAID") {
          throw new OrderExpiryError(
            "No puedes vencer un pedido ya pagado.",
            "ORDER_NOT_CANCELLABLE",
          );
        }
        if (order.status === "PARTIALLY_PAID") {
          throw new OrderExpiryError(
            "El pedido tiene pagos validados. Cancela los pagos o gestiona la devolución manualmente antes de vencerlo.",
            "ORDER_NOT_CANCELLABLE",
          );
        }
        if (order.expiresAt.getTime() > Date.now()) {
          throw new OrderExpiryError(
            "La reserva aún no ha vencido.",
            "ORDER_NOT_EXPIRED",
          );
        }

        // Liberar stock reservado por cada item.
        for (const item of order.items) {
          if (item.quantity <= 0) continue;
          await releaseStock(item.variantId, item.quantity, {
            reason: input.reason ?? `Reserva vencida ${order.orderNumber}`,
            movementType: "EXPIRE",
            tx,
          });
        }

        // Rechazar pagos PENDING asociados a este pedido.
        for (const payment of order.payments) {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: "REJECTED",
              rejectedAt: new Date(),
              rejectionReason:
                input.reason ?? `Reserva ${order.orderNumber} vencida`,
              validatedAt: null,
            },
          });
        }

        // Saldo del pedido a 0 al vencer (la clienta ya no debe).
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: "EXPIRED",
            expiredAt: new Date(),
            expiredById: input.expiredById ?? null,
            balance: "0",
          },
        });

        const releasedUnits = order.items.reduce((acc, i) => acc + i.quantity, 0);
        return { orderId: order.id, releasedUnits };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 },
    );
  } catch (error) {
    if (error instanceof OrderExpiryError) throw error;
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2034" || error.message.includes("serialization"))
    ) {
      throw new OrderExpiryError(
        "Conflicto al vencer la reserva. Intenta nuevamente.",
        "CONFLICT",
      );
    }
    throw error;
  }
}
