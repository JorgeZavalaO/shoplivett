// Motor de envíos agrupados. Maneja creación, listado, edición de tracking,
// cambio de estado y cancelación. Todas las escrituras se hacen dentro de una
// transacción Prisma para mantener la integridad entre el envío, sus pedidos
// y los snapshots de la clienta.

import { Prisma, type ShippingMethod, type ShipmentStatus } from "@prisma/client";

import { getPrisma } from "@/lib/prisma";
import { SHIPPING_METHOD_LABELS } from "@/lib/settings-defaults";
import { toCents, centsToDecimalString, type Cents } from "@/lib/money";
import { auditInTx } from "@/lib/audit";
import { recognizeOrderProfit, distributeOrderDiscount } from "@/lib/order-batch-allocation";
import { coercePaymentMethodFees, type PaymentMethodFees } from "@/lib/settings-defaults";

export class ShipmentError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "SHIPMENT_NOT_FOUND"
      | "CUSTOMER_NOT_FOUND"
      | "ORDER_NOT_FOUND"
      | "EMPTY_ORDERS"
      | "CUSTOMER_MISMATCH"
      | "ORDER_NOT_PAID"
      | "ORDER_ALREADY_SHIPPED"
      | "INVALID_STATUS_TRANSITION"
      | "INVALID_AMOUNT"
      | "INVALID_SHIPPING_METHOD"
      | "CONFLICT",
  ) {
    super(message);
    this.name = "ShipmentError";
  }
}

function shipmentToCents(value: string): Cents {
  try {
    return toCents(value, { allowNegative: true });
  } catch {
    throw new ShipmentError("Monto inválido.", "INVALID_AMOUNT");
  }
}

export type CreateShipmentInput = {
  customerId: string;
  shippingMethod: ShippingMethod;
  orderIds: string[];
  shippingCost: string;
  realCost?: string;
  forceFreeShipping?: boolean;
  agencyName?: string | null;
  trackingCode?: string | null;
  addressSnapshot?: string | null;
  districtSnapshot?: string | null;
  referenceSnapshot?: string | null;
  notes?: string | null;
  createdById?: string | null;
  actorId?: string | null;
};

export type UpdateShipmentInput = {
  shipmentId: string;
  shippingCost?: string;
  realCost?: string;
  isFreeShipping?: boolean;
  shippingMethod?: ShippingMethod;
  agencyName?: string | null;
  trackingCode?: string | null;
  addressSnapshot?: string | null;
  districtSnapshot?: string | null;
  referenceSnapshot?: string | null;
  notes?: string | null;
  updatedById?: string | null;
  actorId?: string | null;
};

const STATUS_FLOW: Record<ShipmentStatus, ShipmentStatus[]> = {
  PENDING: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function canTransition(from: ShipmentStatus, to: ShipmentStatus): boolean {
  return STATUS_FLOW[from]?.includes(to) ?? false;
}

function allocateShipmentRealCost(
  orders: Array<{ id: string; total: { toString(): string } }>,
  realCostCents: Cents,
) {
  const allocations = distributeOrderDiscount(
    orders.map((order) => ({
      variantId: order.id,
      quantity: 1,
      lineSubtotalCents: shipmentToCents(order.total.toString()),
    })),
    realCostCents,
  );
  return new Map(orders.map((order) => [order.id, allocations.get(order.id) ?? 0]));
}

async function recognizeShipmentOrderProfit(
  tx: Prisma.TransactionClient,
  orderIds: string[],
  actorId: string | null,
  source: "SHIPMENT_CREATED" | "SHIPMENT_UPDATED" | "SHIPMENT_CANCELLED",
) {
  if (orderIds.length === 0) return;
  const settings = await tx.businessSettings.findUnique({
    where: { id: "default" },
    select: { paymentMethodFees: true, standardPackagingCostPen: true },
  });
  const fees: PaymentMethodFees = settings
    ? coercePaymentMethodFees(settings.paymentMethodFees)
    : { YAPE: 0, PLIN: 0, CASH: 0, OTHER: 0 };
  const packaging = settings ? settings.standardPackagingCostPen.toString() : "0.00";

  await Promise.all(
    orderIds.map(async (orderId) => {
      const profit = await recognizeOrderProfit(tx, orderId, {
        paymentMethodFees: fees,
        packagingCostPen: packaging,
        recalculate: true,
      });
      await auditInTx(tx, actorId, {
        action: "ORDER_PROFIT_RECOGNIZED",
        entity: "Order",
        entityId: orderId,
        metadata: {
          source,
          productCostPen: centsToDecimalString(profit.productCostCents),
          grossProfitPen: centsToDecimalString(profit.grossProfitCents),
          paymentFeePen: centsToDecimalString(profit.paymentFeeCents),
          packagingCostPen: centsToDecimalString(profit.packagingCostCents),
          deliveryBusinessCostPen: centsToDecimalString(profit.deliveryBusinessCostCents),
          netProfitPen: centsToDecimalString(profit.netProfitCents),
        },
      });
    }),
  );
}

export async function createShipment(
  input: CreateShipmentInput,
): Promise<{ shipmentId: string }> {
  if (input.orderIds.length === 0) {
    throw new ShipmentError(
      "Selecciona al menos un pedido para crear el envío.",
      "EMPTY_ORDERS",
    );
  }
  const prisma = getPrisma();
  try {
    return await prisma.$transaction(
      async (tx) => {
        const customer = await tx.customer.findUnique({
          where: { id: input.customerId },
          select: { id: true, address: true, district: true, reference: true },
        });
        if (!customer) {
          throw new ShipmentError("La clienta ya no existe.", "CUSTOMER_NOT_FOUND");
        }
        const uniqueIds = Array.from(new Set(input.orderIds));
        const orders = await tx.order.findMany({
          where: { id: { in: uniqueIds } },
          select: {
            id: true,
            customerId: true,
            status: true,
            total: true,
            balance: true,
            shipmentOrders: {
              where: { shipment: { status: { not: "CANCELLED" } } },
              select: { id: true, shipmentId: true, shipment: { select: { status: true } } },
              take: 1,
            },
          },
        });
        if (orders.length !== uniqueIds.length) {
          throw new ShipmentError("Uno de los pedidos ya no existe.", "ORDER_NOT_FOUND");
        }
        const mismatched = orders.find((o) => o.customerId !== input.customerId);
        if (mismatched) {
          throw new ShipmentError(
            "Todos los pedidos deben pertenecer a la misma clienta del envío.",
            "CUSTOMER_MISMATCH",
          );
        }
        for (const o of orders) {
          if (o.status !== "PAID") {
            throw new ShipmentError(
              `El pedido debe estar pagado para incluirlo en un envío.`,
              "ORDER_NOT_PAID",
            );
          }
          if (o.shipmentOrders.length > 0) {
            const target = o.shipmentOrders[0].shipment;
            if (target.status !== "CANCELLED") {
              throw new ShipmentError(
                `El pedido ya pertenece a un envío activo.`,
                "ORDER_ALREADY_SHIPPED",
              );
            }
          }
        }

        const settings = await tx.businessSettings.findUnique({
          where: { id: "default" },
          select: { freeShippingEnabled: true, freeShippingThreshold: true },
        });
        const freeShippingEnabled = settings?.freeShippingEnabled ?? false;
        const freeShippingThreshold = settings
          ? shipmentToCents(settings.freeShippingThreshold.toString())
          : 0;

        const totalCents = orders.reduce(
          (acc, o) => acc + shipmentToCents(o.total.toString()),
          0,
        );

        const shippingCents = shipmentToCents(input.shippingCost || "0");
        const realCostCents = shipmentToCents(input.realCost || "0");
        let finalCostCents = shippingCents;
        let isFree = false;
        if (input.forceFreeShipping) {
          isFree = true;
          finalCostCents = 0;
        } else if (
          freeShippingEnabled &&
          freeShippingThreshold > 0 &&
          totalCents >= freeShippingThreshold
        ) {
          isFree = true;
          finalCostCents = 0;
        }
        const freeShippingRule = {
          enabled: freeShippingEnabled,
          threshold: centsToDecimalString(freeShippingThreshold),
          ordersTotal: centsToDecimalString(totalCents),
          autoApplied:
            !input.forceFreeShipping && isFree && freeShippingEnabled,
        };

        const realCostByOrder = allocateShipmentRealCost(orders, realCostCents);

        const shipment = await tx.shipment.create({
          data: {
            customerId: input.customerId,
            shippingMethod: input.shippingMethod,
            status: "PENDING",
            shippingCost: centsToDecimalString(finalCostCents),
            realCostPen: centsToDecimalString(realCostCents),
            isFreeShipping: isFree,
            freeShippingRule,
            agencyName: input.agencyName ?? null,
            trackingCode: input.trackingCode ?? null,
            addressSnapshot: input.addressSnapshot ?? customer.address,
            districtSnapshot: input.districtSnapshot ?? customer.district,
            referenceSnapshot: input.referenceSnapshot ?? customer.reference,
            notes: input.notes ?? null,
            createdById: input.createdById ?? null,
          },
        });

        await tx.shipmentOrder.createMany({
          data: orders.map((o) => ({
            shipmentId: shipment.id,
            orderId: o.id,
            allocatedShippingCostPen: centsToDecimalString(
              realCostByOrder.get(o.id) ?? 0,
            ),
          })),
        });

        await recognizeShipmentOrderProfit(
          tx,
          uniqueIds,
          input.actorId ?? input.createdById ?? null,
          "SHIPMENT_CREATED",
        );

        await auditInTx(tx, input.actorId ?? input.createdById ?? null, {
          action: "SHIPMENT_CREATED",
          entity: "Shipment",
          entityId: shipment.id,
          metadata: {
            customerId: input.customerId,
            shippingMethod: input.shippingMethod,
            ordersCount: uniqueIds.length,
            orderIds: uniqueIds,
            shippingCost: centsToDecimalString(finalCostCents),
            realCostPen: centsToDecimalString(realCostCents),
            isFreeShipping: isFree,
            agencyName: input.agencyName ?? null,
            trackingCode: input.trackingCode ?? null,
            freeShippingRule,
          },
        });

        return { shipmentId: shipment.id };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 },
    );
  } catch (error) {
    if (error instanceof ShipmentError) throw error;
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2034" || error.message.includes("serialization"))
    ) {
      throw new ShipmentError("Conflicto al crear el envío. Intenta nuevamente.", "CONFLICT");
    }
    throw error;
  }
}

export async function updateShipment(
  input: UpdateShipmentInput,
): Promise<{ shipmentId: string }> {
  const prisma = getPrisma();
  try {
    return await prisma.$transaction(
      async (tx) => {
        const shipment = await tx.shipment.findUnique({
          where: { id: input.shipmentId },
          select: {
            id: true,
            status: true,
            shippingMethod: true,
            realCostPen: true,
            shippingCost: true,
            isFreeShipping: true,
            freeShippingRule: true,
            addressSnapshot: true,
            districtSnapshot: true,
            referenceSnapshot: true,
            agencyName: true,
            trackingCode: true,
            notes: true,
          },
        });
        if (!shipment) {
          throw new ShipmentError("El envío ya no existe.", "SHIPMENT_NOT_FOUND");
        }
        if (shipment.status === "DELIVERED" || shipment.status === "CANCELLED") {
          throw new ShipmentError(
            "No puedes editar un envío entregado o cancelado.",
            "INVALID_STATUS_TRANSITION",
          );
        }

        const shipmentOrders = await tx.shipmentOrder.findMany({
          where: { shipmentId: input.shipmentId },
          select: {
            orderId: true,
            order: { select: { id: true, total: true } },
          },
        });

        const data: Prisma.ShipmentUpdateInput = {};
        if (input.shippingMethod) data.shippingMethod = input.shippingMethod;
        if (typeof input.agencyName !== "undefined") data.agencyName = input.agencyName;
        if (typeof input.trackingCode !== "undefined") data.trackingCode = input.trackingCode;
        if (typeof input.addressSnapshot !== "undefined")
          data.addressSnapshot = input.addressSnapshot;
        if (typeof input.districtSnapshot !== "undefined")
          data.districtSnapshot = input.districtSnapshot;
        if (typeof input.referenceSnapshot !== "undefined")
          data.referenceSnapshot = input.referenceSnapshot;
        if (typeof input.notes !== "undefined") data.notes = input.notes;
        if (typeof input.updatedById !== "undefined" && input.updatedById) {
          data.updatedBy = { connect: { id: input.updatedById } };
        }
        const nextRealCostCents =
          typeof input.realCost !== "undefined"
            ? shipmentToCents(input.realCost)
            : shipmentToCents(shipment.realCostPen.toString());
        if (typeof input.realCost !== "undefined") {
          data.realCostPen = centsToDecimalString(nextRealCostCents);
        }

        if (typeof input.isFreeShipping === "boolean") {
          data.isFreeShipping = input.isFreeShipping;
          if (input.isFreeShipping) {
            data.shippingCost = "0.00";
          } else if (input.shippingCost) {
            const cents = shipmentToCents(input.shippingCost);
            data.shippingCost = centsToDecimalString(cents);
          }
        } else if (input.shippingCost) {
          if (shipment.isFreeShipping) {
            data.shippingCost = "0.00";
          } else {
            const cents = shipmentToCents(input.shippingCost);
            data.shippingCost = centsToDecimalString(cents);
          }
        }

        if (shipmentOrders.length > 0) {
          const realCostByOrder = allocateShipmentRealCost(
            shipmentOrders.map((link) => link.order),
            nextRealCostCents,
          );
          await Promise.all(
            shipmentOrders.map((link) =>
              tx.shipmentOrder.updateMany({
                where: { shipmentId: input.shipmentId, orderId: link.orderId },
                data: {
                  allocatedShippingCostPen: centsToDecimalString(
                    realCostByOrder.get(link.orderId) ?? 0,
                  ),
                },
              }),
            ),
          );
        }

        await tx.shipment.update({ where: { id: input.shipmentId }, data });
        await recognizeShipmentOrderProfit(
          tx,
          shipmentOrders.map((link) => link.orderId),
          input.actorId ?? input.updatedById ?? null,
          "SHIPMENT_UPDATED",
        );
        await auditInTx(tx, input.actorId ?? input.updatedById ?? null, {
          action: "SHIPMENT_UPDATED",
          entity: "Shipment",
          entityId: input.shipmentId,
          metadata: {
            kind: "update",
            updatedFields: Object.keys(data),
          },
        });
        return { shipmentId: input.shipmentId };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 15000,
      },
    );
  } catch (error) {
    if (error instanceof ShipmentError) throw error;
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2034" || error.message.includes("serialization"))
    ) {
      throw new ShipmentError("Conflicto al actualizar el envío. Intenta nuevamente.", "CONFLICT");
    }
    throw error;
  }
}

export async function changeShipmentStatus(
  input: { shipmentId: string; to: ShipmentStatus; actorId?: string | null; notes?: string | null },
): Promise<{ shipmentId: string }> {
  const prisma = getPrisma();
  try {
    return await prisma.$transaction(
      async (tx) => {
        const shipment = await tx.shipment.findUnique({
          where: { id: input.shipmentId },
          select: { id: true, status: true, realCostPen: true, shippingCost: true, isFreeShipping: true },
        });
        if (!shipment) {
          throw new ShipmentError("El envío ya no existe.", "SHIPMENT_NOT_FOUND");
        }
        if (!canTransition(shipment.status, input.to)) {
          throw new ShipmentError(
            `No puedes pasar de ${shipment.status} a ${input.to}.`,
            "INVALID_STATUS_TRANSITION",
          );
        }
        const shipmentOrders =
          input.to === "CANCELLED"
            ? await tx.shipmentOrder.findMany({
                where: { shipmentId: input.shipmentId },
                select: { orderId: true },
              })
            : [];
        const now = new Date();
        const data: Prisma.ShipmentUpdateInput = { status: input.to };
        if (input.to === "PREPARING") data.preparedAt = now;
        if (input.to === "SHIPPED") data.shippedAt = now;
        if (input.to === "DELIVERED") data.deliveredAt = now;
        if (input.to === "CANCELLED") {
          data.cancelledAt = now;
          if (input.notes) data.notes = input.notes;
        }
        await tx.shipment.update({ where: { id: input.shipmentId }, data });
        if (input.to === "CANCELLED") {
          await recognizeShipmentOrderProfit(
            tx,
            shipmentOrders.map((link) => link.orderId),
            input.actorId ?? null,
            "SHIPMENT_CANCELLED",
          );
        }
        await auditInTx(tx, input.actorId ?? null, {
          action:
            input.to === "CANCELLED" ? "SHIPMENT_CANCELLED" : "SHIPMENT_STATUS_CHANGED",
          entity: "Shipment",
          entityId: input.shipmentId,
          metadata: {
            from: shipment.status,
            to: input.to,
            ...(input.notes ? { notes: input.notes } : {}),
          },
        });
        return { shipmentId: input.shipmentId };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 15000,
      },
    );
  } catch (error) {
    if (error instanceof ShipmentError) throw error;
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2034" || error.message.includes("serialization"))
    ) {
      throw new ShipmentError("Conflicto al cambiar el estado. Intenta nuevamente.", "CONFLICT");
    }
    throw error;
  }
}

export async function cancelShipment(
  input: { shipmentId: string; reason?: string | null; actorId?: string | null },
): Promise<{ shipmentId: string }> {
  // El motivo/nota se persiste en la misma transacción que el cambio de estado
  // para evitar cancelaciones sin motivo cuando el segundo `update` fallaba.
  return changeShipmentStatus({
    shipmentId: input.shipmentId,
    to: "CANCELLED",
    actorId: input.actorId ?? null,
    notes: input.reason ?? null,
  });
}

export async function listShipments(args?: {
  query?: string;
  status?: ShipmentStatus | "ALL";
  customerId?: string;
  page?: number;
  perPage?: number;
}) {
  const prisma = getPrisma();
  const safePage = Math.max(1, args?.page ?? 1);
  const safePerPage = Math.min(100, Math.max(1, args?.perPage ?? 20));
  const query = args?.query?.trim() ?? "";
  const status = args?.status ?? "ALL";
  const customerId = args?.customerId?.trim();

  const where: Prisma.ShipmentWhereInput = {
    ...(status !== "ALL" ? { status } : {}),
    ...(customerId ? { customerId } : {}),
    ...(query
      ? {
          OR: [
            { trackingCode: { contains: query, mode: "insensitive" } },
            { agencyName: { contains: query, mode: "insensitive" } },
            { customer: { name: { contains: query, mode: "insensitive" } } },
            { customer: { whatsapp: { contains: query.replace(/\D/g, "") } } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.shipment.count({ where }),
    prisma.shipment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safePerPage,
      take: safePerPage,
      include: {
        customer: { select: { id: true, name: true, whatsapp: true } },
        _count: { select: { orders: true } },
      },
    }),
  ]);

  return {
    items: items.map((s) => ({
      id: s.id,
      status: s.status,
      shippingMethod: s.shippingMethod,
      shippingCost: s.shippingCost.toString(),
      realCostPen: s.realCostPen.toString(),
      isFreeShipping: s.isFreeShipping,
      agencyName: s.agencyName,
      trackingCode: s.trackingCode,
      createdAt: s.createdAt,
      shippedAt: s.shippedAt,
      deliveredAt: s.deliveredAt,
      customer: s.customer,
      orderCount: s._count.orders,
    })),
    total,
    page: safePage,
    perPage: safePerPage,
    status,
    query,
  };
}

export async function getShipmentDetail(shipmentId: string) {
  if (!shipmentId) return null;
  const prisma = getPrisma();
  return prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          whatsapp: true,
          address: true,
          district: true,
          reference: true,
        },
      },
      createdBy: { select: { id: true, name: true, email: true } },
      updatedBy: { select: { id: true, name: true, email: true } },
      orders: {
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              total: true,
              balance: true,
              validatedPaid: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });
}

export async function getEligibleOrdersForShipment(
  customerId: string,
  query?: string,
) {
  if (!customerId) return [];
  const trimmed = query?.trim() ?? "";
  const prisma = getPrisma();
  const rows = await prisma.order.findMany({
    where: {
      customerId,
      status: "PAID",
      shipmentOrders: { none: { shipment: { status: { not: "CANCELLED" } } } },
      ...(trimmed
        ? { orderNumber: { contains: trimmed, mode: "insensitive" } }
        : {}),
    },
    take: 50,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderNumber: true,
      total: true,
      balance: true,
      status: true,
      createdAt: true,
    },
  });
  return rows
    .map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      total: o.total.toString(),
      balance: o.balance.toString(),
      status: o.status,
      createdAt: o.createdAt,
    }));
}

export async function getOrderShipmentLink(orderId: string) {
  const prisma = getPrisma();
  const link = await prisma.shipmentOrder.findFirst({
    where: { orderId, shipment: { status: { not: "CANCELLED" } } },
    orderBy: { createdAt: "desc" },
    include: { shipment: { select: { id: true, status: true } } },
  });
  return link?.shipment ?? null;
}

export async function listCustomerShipments(customerId: string) {
  if (!customerId) return [];
  const prisma = getPrisma();
  const rows = await prisma.shipment.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      _count: { select: { orders: true } },
      orders: {
        take: 20,
        orderBy: { createdAt: "desc" },
        include: {
          order: { select: { id: true, orderNumber: true, total: true } },
        },
      },
    },
  });
  return rows.map((s) => ({
    id: s.id,
    status: s.status,
    shippingMethod: s.shippingMethod,
    shippingCost: s.shippingCost.toString(),
    realCostPen: s.realCostPen.toString(),
    isFreeShipping: s.isFreeShipping,
    agencyName: s.agencyName,
    trackingCode: s.trackingCode,
    createdAt: s.createdAt,
    shippedAt: s.shippedAt,
    deliveredAt: s.deliveredAt,
    cancelledAt: s.cancelledAt,
    orderCount: s._count.orders,
    orders: s.orders.map((o) => ({
      id: o.order.id,
      orderNumber: o.order.orderNumber,
      total: o.order.total.toString(),
    })),
  }));
}

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  PENDING: "Pendiente",
  PREPARING: "Preparando",
  READY: "Listo",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

export { SHIPPING_METHOD_LABELS };

