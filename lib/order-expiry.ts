// Lógica de reservas vencidas. Lista pedidos cuya fecha de expiración ya pasó
// y permite cancelarlos manualmente liberando el stock reservado.

import { Prisma, OrderStatus } from "@prisma/client";

import { getPrisma } from "@/lib/prisma";
import { releaseStock } from "@/lib/inventory";
import { auditInTx } from "@/lib/audit";
import { releaseOrderItemAllocations } from "@/lib/order-batch-allocation";

export class OrderExpiryError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "ORDER_NOT_FOUND"
      | "ORDER_NOT_EXPIRED"
      | "ORDER_NOT_CANCELLABLE"
      | "ALREADY_EXPIRED"
      | "ALREADY_CANCELLED"
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

export type CloseReservationReason = "EXPIRED" | "CANCELLED";

export type CloseReservationInput = {
  orderId: string;
  reason: CloseReservationReason;
  actorId?: string | null;
  notes?: string | null;
  tx: Prisma.TransactionClient;
};

/**
 * Cierra una reserva no pagada liberando stock reservado, rechazando pagos
 * pendientes y dejando el pedido en `EXPIRED` o `CANCELLED` con `balance = 0`.
 * Pensado para ser invocado dentro de una transacción existente.
 */
export async function closeUnpaidReservation(
  input: CloseReservationInput,
): Promise<{ releasedUnits: number; orderNumber: string }> {
  const order = await input.tx.order.findUnique({
    where: { id: input.orderId },
    include: {
      items: { select: { id: true, variantId: true, quantity: true } },
      payments: { where: { status: "PENDING" }, select: { id: true } },
      paymentApplications: {
        where: { payment: { status: "PENDING" } },
        select: {
          paymentId: true,
          payment: {
            select: {
              id: true,
              applications: { select: { orderId: true } },
            },
          },
        },
      },
    },
  });
  if (!order) {
    throw new OrderExpiryError("El pedido ya no existe.", "ORDER_NOT_FOUND");
  }
  if (order.status === "EXPIRED") {
    throw new OrderExpiryError("El pedido ya está vencido.", "ALREADY_EXPIRED");
  }
  if (order.status === "CANCELLED") {
    throw new OrderExpiryError("El pedido está cancelado.", "ALREADY_CANCELLED");
  }
  if (order.status === "PAID") {
    throw new OrderExpiryError(
      "No puedes cerrar un pedido ya pagado.",
      "ORDER_NOT_CANCELLABLE",
    );
  }
  if (order.status === "PARTIALLY_PAID") {
    throw new OrderExpiryError(
      "El pedido tiene pagos validados. Cancela los pagos o gestiona la devolución manualmente antes de cerrarlo.",
      "ORDER_NOT_CANCELLABLE",
    );
  }

  for (const item of order.items) {
    if (item.quantity <= 0) continue;
    await releaseStock(item.variantId, item.quantity, {
      reason: input.notes ?? `Reserva ${order.orderNumber}`,
      movementType: "EXPIRE",
      tx: input.tx,
    });
    const released = await releaseOrderItemAllocations(input.tx, item.id);
    if (released.length > 0) {
      await auditInTx(input.tx, input.actorId ?? null, {
        action: "ORDER_BATCH_ALLOCATION_RELEASED",
        entity: "OrderItem",
        entityId: item.id,
        metadata: {
          orderId: order.id,
          reason: input.reason,
          released,
        },
      });
    }
  }

  const directPaymentIds = order.payments.map((payment) => payment.id);
  const appliedPaymentIds = order.paymentApplications.map((app) => app.paymentId);
  const paymentIdsToReject = new Set(directPaymentIds);

  for (const application of order.paymentApplications) {
    const applications = application.payment.applications;
    if (applications.length <= 1) {
      paymentIdsToReject.add(application.paymentId);
      continue;
    }

    await input.tx.paymentApplication.delete({
      where: {
        paymentId_orderId: {
          paymentId: application.paymentId,
          orderId: order.id,
        },
      },
    });
    await auditInTx(input.tx, input.actorId ?? null, {
      action: "PAYMENT_APPLICATIONS_UPDATED",
      entity: "Payment",
      entityId: application.paymentId,
      metadata: {
        reason: "ORDER_CLOSED",
        removedOrderId: order.id,
        remainingApplications: applications.length - 1,
      },
    });
  }

  for (const paymentId of paymentIdsToReject) {
    await input.tx.payment.update({
      where: { id: paymentId },
      data: {
        status: "REJECTED",
        rejectedAt: new Date(),
        rejectionReason:
          input.notes ?? `Reserva ${order.orderNumber} cerrada`,
        validatedAt: null,
      },
    });
  }

  const affectedPaymentIds = Array.from(new Set([...directPaymentIds, ...appliedPaymentIds]));

  const targetStatus: OrderStatus =
    input.reason === "CANCELLED" ? "CANCELLED" : "EXPIRED";

  await input.tx.order.update({
    where: { id: order.id },
    data: {
      status: targetStatus,
      balance: "0",
      ...(input.reason === "EXPIRED"
        ? { expiredAt: new Date(), expiredById: input.actorId ?? null }
        : {}),
    },
  });

  const auditAction =
    input.reason === "CANCELLED" ? "ORDER_CANCELLED" : "ORDER_EXPIRED";
  await auditInTx(input.tx, input.actorId ?? null, {
    action: auditAction,
    entity: "Order",
    entityId: order.id,
    metadata: {
      orderNumber: order.orderNumber,
      trigger: input.notes ?? null,
      affectedPaymentIds,
    },
  });

  const releasedUnits = order.items.reduce((acc, i) => acc + i.quantity, 0);
  return { releasedUnits, orderNumber: order.orderNumber };
}

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
          select: { expiresAt: true },
        });
        if (!order) {
          throw new OrderExpiryError("El pedido ya no existe.", "ORDER_NOT_FOUND");
        }
        if (order.expiresAt.getTime() > Date.now()) {
          throw new OrderExpiryError(
            "La reserva aún no ha vencido.",
            "ORDER_NOT_EXPIRED",
          );
        }
        const result = await closeUnpaidReservation({
          orderId: input.orderId,
          reason: "EXPIRED",
          actorId: input.expiredById ?? null,
          notes: input.reason ?? null,
          tx,
        });
        return { orderId: input.orderId, releasedUnits: result.releasedUnits };
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

/**
 * Cancela manualmente una reserva no pagada. Libera stock y rechaza pagos
 * pendientes del pedido. No aplica a pedidos con pagos validados.
 */
export async function cancelUnpaidOrder(input: {
  orderId: string;
  actorId?: string | null;
  reason?: string | null;
}): Promise<{ orderId: string; releasedUnits: number }> {
  const prisma = getPrisma();
  try {
    return await prisma.$transaction(
      async (tx) => {
        const result = await closeUnpaidReservation({
          orderId: input.orderId,
          reason: "CANCELLED",
          actorId: input.actorId ?? null,
          notes: input.reason ?? null,
          tx,
        });
        return { orderId: input.orderId, releasedUnits: result.releasedUnits };
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
        "Conflicto al cancelar la reserva. Intenta nuevamente.",
        "CONFLICT",
      );
    }
    throw error;
  }
}
