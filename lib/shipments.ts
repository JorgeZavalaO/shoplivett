// Motor de envíos agrupados. Maneja creación, listado, edición de tracking,
// cambio de estado y cancelación. Todas las escrituras se hacen dentro de una
// transacción Prisma para mantener la integridad entre el envío, sus pedidos
// y los snapshots de la clienta.

import { Prisma, type ShippingMethod, type ShipmentStatus } from "@prisma/client";

import { getPrisma } from "@/lib/prisma";
import { SHIPPING_METHOD_LABELS } from "@/lib/settings-defaults";

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

type Cents = number;

function toCents(value: string): Cents {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    throw new ShipmentError("Monto inválido.", "INVALID_AMOUNT");
  }
  const [whole, fraction = ""] = value.trim().split(".");
  const safeWhole = (whole || "0").replace(/[^0-9]/g, "") || "0";
  const safeFraction = (fraction || "").replace(/[^0-9]/g, "").padEnd(2, "0").slice(0, 2);
  return Number(safeWhole) * 100 + Number(safeFraction);
}

function centsToDecimalString(cents: Cents): string {
  const negative = cents < 0;
  const abs = negative ? -cents : cents;
  const whole = Math.trunc(abs / 100);
  const fraction = Math.trunc(abs % 100);
  const fracStr = String(fraction).padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fracStr}`;
}

export type CreateShipmentInput = {
  customerId: string;
  shippingMethod: ShippingMethod;
  orderIds: string[];
  shippingCost: string;
  forceFreeShipping?: boolean;
  agencyName?: string | null;
  trackingCode?: string | null;
  addressSnapshot?: string | null;
  districtSnapshot?: string | null;
  referenceSnapshot?: string | null;
  notes?: string | null;
  createdById?: string | null;
};

export type UpdateShipmentInput = {
  shipmentId: string;
  shippingCost?: string;
  isFreeShipping?: boolean;
  shippingMethod?: ShippingMethod;
  agencyName?: string | null;
  trackingCode?: string | null;
  addressSnapshot?: string | null;
  districtSnapshot?: string | null;
  referenceSnapshot?: string | null;
  notes?: string | null;
  updatedById?: string | null;
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
        const customer = await tx.customer.findUnique({ where: { id: input.customerId } });
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
            shipmentOrder: { select: { id: true, shipmentId: true, shipment: { select: { status: true } } } },
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
          if (o.shipmentOrder) {
            const target = o.shipmentOrder.shipment;
            if (target.status !== "CANCELLED") {
              throw new ShipmentError(
                `El pedido ya pertenece a un envío activo.`,
                "ORDER_ALREADY_SHIPPED",
              );
            }
          }
        }

        const settings = await tx.businessSettings.findUnique({ where: { id: "default" } });
        const freeShippingEnabled = settings?.freeShippingEnabled ?? false;
        const freeShippingThreshold = settings
          ? toCents(settings.freeShippingThreshold.toString())
          : 0;

        const totalCents = orders.reduce(
          (acc, o) => acc + toCents(o.total.toString()),
          0,
        );

        const shippingCents = toCents(input.shippingCost || "0");
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

        const shipment = await tx.shipment.create({
          data: {
            customerId: input.customerId,
            shippingMethod: input.shippingMethod,
            status: "PENDING",
            shippingCost: centsToDecimalString(finalCostCents),
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

        for (const o of orders) {
          await tx.shipmentOrder.create({
            data: { shipmentId: shipment.id, orderId: o.id },
          });
        }

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
    return await prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUnique({ where: { id: input.shipmentId } });
      if (!shipment) {
        throw new ShipmentError("El envío ya no existe.", "SHIPMENT_NOT_FOUND");
      }
      if (shipment.status === "DELIVERED" || shipment.status === "CANCELLED") {
        throw new ShipmentError(
          "No puedes editar un envío entregado o cancelado.",
          "INVALID_STATUS_TRANSITION",
        );
      }

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

      if (typeof input.isFreeShipping === "boolean") {
        data.isFreeShipping = input.isFreeShipping;
        if (input.isFreeShipping) {
          data.shippingCost = "0.00";
        } else if (input.shippingCost) {
          const cents = toCents(input.shippingCost);
          data.shippingCost = centsToDecimalString(cents);
        }
      } else if (input.shippingCost) {
        if (shipment.isFreeShipping) {
          data.shippingCost = "0.00";
        } else {
          const cents = toCents(input.shippingCost);
          data.shippingCost = centsToDecimalString(cents);
        }
      }

      await tx.shipment.update({ where: { id: input.shipmentId }, data });
      return { shipmentId: input.shipmentId };
    });
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
  input: { shipmentId: string; to: ShipmentStatus },
): Promise<{ shipmentId: string }> {
  const prisma = getPrisma();
  try {
    return await prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUnique({ where: { id: input.shipmentId } });
      if (!shipment) {
        throw new ShipmentError("El envío ya no existe.", "SHIPMENT_NOT_FOUND");
      }
      if (!canTransition(shipment.status, input.to)) {
        throw new ShipmentError(
          `No puedes pasar de ${shipment.status} a ${input.to}.`,
          "INVALID_STATUS_TRANSITION",
        );
      }
      const now = new Date();
      const data: Prisma.ShipmentUpdateInput = { status: input.to };
      if (input.to === "PREPARING") data.preparedAt = now;
      if (input.to === "SHIPPED") data.shippedAt = now;
      if (input.to === "DELIVERED") data.deliveredAt = now;
      if (input.to === "CANCELLED") data.cancelledAt = now;
      await tx.shipment.update({ where: { id: input.shipmentId }, data });
      return { shipmentId: input.shipmentId };
    });
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
  input: { shipmentId: string; reason?: string | null },
): Promise<{ shipmentId: string }> {
  return changeShipmentStatus({
    shipmentId: input.shipmentId,
    to: "CANCELLED",
  }).then(async (result) => {
    if (input.reason) {
      const prisma = getPrisma();
      await prisma.shipment.update({
        where: { id: input.shipmentId },
        data: { notes: input.reason },
      });
    }
    return result;
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
      customer: true,
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
      shipmentOrder: {
        select: {
          id: true,
          shipment: { select: { id: true, status: true } },
        },
      },
    },
  });
  return rows
    .filter((o) => !o.shipmentOrder || o.shipmentOrder.shipment.status === "CANCELLED")
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
  const link = await prisma.shipmentOrder.findUnique({
    where: { orderId },
    include: { shipment: { select: { id: true, status: true } } },
  });
  return link && link.shipment.status !== "CANCELLED" ? link.shipment : null;
}

export async function listCustomerShipments(customerId: string) {
  if (!customerId) return [];
  const prisma = getPrisma();
  const rows = await prisma.shipment.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    include: {
      orders: {
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
    isFreeShipping: s.isFreeShipping,
    agencyName: s.agencyName,
    trackingCode: s.trackingCode,
    createdAt: s.createdAt,
    shippedAt: s.shippedAt,
    deliveredAt: s.deliveredAt,
    cancelledAt: s.cancelledAt,
    orderCount: s.orders.length,
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
