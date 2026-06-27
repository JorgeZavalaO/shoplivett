// Modulo de dominio para Incidents (Sprint 23).
//
// Casos soportados:
//  - RETURN con RESTOCK: se devuelve mercaderia en buen estado a stock
//    (incrementa `stock` y reduce `soldStock` si la venta ya estaba confirmada).
//  - RETURN con CREDIT: se crea un CustomerCredit con origin MANUAL.
//  - RETURN con REPLACE/DISCARDED: solo registro.
//  - DAMAGE/LOSS en stock propio (sin pedido): se reduce `stock` y se registra
//    movimiento ADJUSTMENT.
//  - DAMAGE/LOSS/CLAIM post-venta: solo se registran los montos perdido/recuperado.
//
// La integracion es transaccional (Serializable) y audita via `auditInTx`.

import { Prisma, type IncidentReturnDecision, type IncidentStatus, type IncidentType } from "@prisma/client";

import { getPrisma } from "@/lib/prisma";
import { toCents, centsToDecimalString } from "@/lib/money";
import { auditInTx } from "@/lib/audit";

export { INCIDENT_TYPE_LABELS, INCIDENT_STATUS_LABELS, INCIDENT_DECISION_LABELS } from "@/lib/incidents-shared";

export const INCIDENT_LIST_SELECT = {
  id: true,
  incidentDate: true,
  type: true,
  status: true,
  decision: true,
  quantity: true,
  description: true,
  recoveredAmount: true,
  lostAmount: true,
  restockQuantity: true,
  createdAt: true,
  resolvedAt: true,
  cancelledAt: true,
  order: { select: { id: true, orderNumber: true } },
  variant: {
    select: {
      id: true,
      code: true,
      color: true,
      product: { select: { id: true, name: true } },
    },
  },
  customer: { select: { id: true, name: true, whatsapp: true } },
  createdBy: { select: { id: true, name: true } },
  resolvedBy: { select: { id: true, name: true } },
} as const;

export const INCIDENT_DETAIL_SELECT = {
  id: true,
  incidentDate: true,
  type: true,
  status: true,
  decision: true,
  orderId: true,
  orderItemId: true,
  variantId: true,
  customerId: true,
  quantity: true,
  description: true,
  recoveredAmount: true,
  lostAmount: true,
  restockQuantity: true,
  creditId: true,
  notes: true,
  resolutionNotes: true,
  cancelledReason: true,
  cancelledAt: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      total: true,
      customer: { select: { id: true, name: true, whatsapp: true } },
    },
  },
  orderItem: {
    select: {
      id: true,
      quantity: true,
      unitPrice: true,
      lineTotal: true,
      totalCostPen: true,
      variant: {
        select: {
          id: true,
          code: true,
          color: true,
          product: { select: { id: true, name: true } },
        },
      },
    },
  },
  variant: {
    select: {
      id: true,
      code: true,
      color: true,
      price: true,
      cost: true,
      stock: true,
      soldStock: true,
      product: { select: { id: true, name: true } },
    },
  },
  customer: { select: { id: true, name: true, whatsapp: true } },
  credit: {
    select: {
      id: true,
      amount: true,
      availableAmount: true,
      status: true,
      origin: true,
    },
  },
  createdBy: { select: { id: true, name: true, email: true } },
  resolvedBy: { select: { id: true, name: true, email: true } },
} as const;

export type IncidentListItem = {
  id: string;
  incidentDate: Date;
  type: IncidentType;
  status: IncidentStatus;
  decision: IncidentReturnDecision;
  quantity: number;
  description: string;
  recoveredAmount: { toString(): string };
  lostAmount: { toString(): string };
  restockQuantity: number;
  createdAt: Date;
  resolvedAt: Date | null;
  cancelledAt: Date | null;
  order: { id: string; orderNumber: string } | null;
  variant: {
    id: string;
    code: string;
    color: string | null;
    product: { id: string; name: string };
  } | null;
  customer: { id: string; name: string; whatsapp: string } | null;
  createdBy: { id: string; name: string } | null;
  resolvedBy: { id: string; name: string } | null;
};

export type IncidentListResult = {
  items: IncidentListItem[];
  total: number;
  page: number;
  perPage: number;
  totals: {
    lostCents: number;
    recoveredCents: number;
    lost: string;
    recovered: string;
  };
  month: { year: number; month: number } | null;
  type: IncidentType | "ALL";
  status: IncidentStatus | "ALL";
  decision: IncidentReturnDecision | "ALL";
  query: string;
};

export type IncidentListFilter = {
  query?: string;
  type?: IncidentType | "ALL";
  status?: IncidentStatus | "ALL";
  decision?: IncidentReturnDecision | "ALL";
  year?: number;
  month?: number; // 1-12
  page?: number;
  perPage?: number;
};

export class IncidentError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "ORDER_NOT_FOUND"
      | "VARIANT_NOT_FOUND"
      | "ITEM_NOT_FOUND"
      | "CUSTOMER_NOT_FOUND"
      | "INCIDENT_NOT_FOUND"
      | "INVALID_AMOUNT"
      | "INVALID_QUANTITY"
      | "INSUFFICIENT_STOCK"
      | "ALREADY_RESOLVED"
      | "ALREADY_CANCELLED"
      | "CREDIT_DISABLED"
      | "CONFLICT",
  ) {
    super(message);
    this.name = "IncidentError";
  }
}

function monthRange(year: number, month: number): { gte: Date; lte: Date } {
  const gte = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const lastDay = new Date(year, month, 0).getDate();
  const lte = new Date(year, month - 1, lastDay, 23, 59, 59, 999);
  return { gte, lte };
}

function buildWhere(filter: IncidentListFilter): Prisma.IncidentWhereInput {
  const where: Prisma.IncidentWhereInput = {};
  if (filter.type && filter.type !== "ALL") where.type = filter.type;
  if (filter.status && filter.status !== "ALL") where.status = filter.status;
  if (filter.decision && filter.decision !== "ALL") {
    where.decision = filter.decision;
  }
  if (filter.year && filter.month) {
    where.incidentDate = monthRange(filter.year, filter.month);
  }
  const trimmed = filter.query?.trim() ?? "";
  if (trimmed) {
    where.OR = [
      { description: { contains: trimmed, mode: "insensitive" } },
      { notes: { contains: trimmed, mode: "insensitive" } },
      { order: { orderNumber: { contains: trimmed, mode: "insensitive" } } },
      { customer: { name: { contains: trimmed, mode: "insensitive" } } },
      { variant: { code: { contains: trimmed, mode: "insensitive" } } },
    ];
  }
  return where;
}

export async function listIncidents(
  filter: IncidentListFilter,
): Promise<IncidentListResult> {
  const prisma = getPrisma();
  const safePage = Math.max(1, Math.floor(filter.page ?? 1));
  const safePerPage = Math.min(100, Math.max(1, Math.floor(filter.perPage ?? 20)));
  const trimmed = filter.query?.trim() ?? "";
  const where = buildWhere(filter);

  const [total, items, lostAgg, recoveredAgg] = await Promise.all([
    prisma.incident.count({ where }),
    prisma.incident.findMany({
      where,
      orderBy: [{ incidentDate: "desc" }, { createdAt: "desc" }],
      skip: (safePage - 1) * safePerPage,
      take: safePerPage,
      select: INCIDENT_LIST_SELECT,
    }),
    prisma.incident.aggregate({
      where: { ...where, status: { not: "CANCELLED" } },
      _sum: { lostAmount: true },
    }),
    prisma.incident.aggregate({
      where: { ...where, status: { not: "CANCELLED" } },
      _sum: { recoveredAmount: true },
    }),
  ]);

  const lostCents = toCents(lostAgg._sum.lostAmount);
  const recoveredCents = toCents(recoveredAgg._sum.recoveredAmount);

  return {
    items: items as unknown as IncidentListItem[],
    total,
    page: safePage,
    perPage: safePerPage,
    totals: {
      lostCents,
      recoveredCents,
      lost: centsToDecimalString(lostCents),
      recovered: centsToDecimalString(recoveredCents),
    },
    month:
      filter.year && filter.month
        ? { year: filter.year, month: filter.month }
        : null,
    type: filter.type ?? "ALL",
    status: filter.status ?? "ALL",
    decision: filter.decision ?? "ALL",
    query: trimmed,
  };
}

export async function getIncidentDetail(id: string) {
  const prisma = getPrisma();
  return prisma.incident.findUnique({
    where: { id },
    select: INCIDENT_DETAIL_SELECT,
  });
}

export type CreateIncidentInput = {
  incidentDate: string;
  type: IncidentType;
  decision: IncidentReturnDecision;
  orderId?: string | null;
  orderItemId?: string | null;
  variantId?: string | null;
  customerId?: string | null;
  quantity: number;
  description: string;
  recoveredAmount?: string | null;
  lostAmount?: string | null;
  restockQuantity?: number | null;
  notes?: string | null;
  createdById: string | null;
};

export type CreateIncidentResult = {
  incidentId: string;
  creditId: string | null;
  restockedUnits: number;
  adjustedUnits: number;
};

/**
 * Crea una incidencia con todas las integraciones transaccionales necesarias:
 *  - Validacion de pedido / variante / item / clienta.
 *  - Si la decision es RESTOCK: se devuelve stock a ProductVariant
 *    (incrementa `stock`; reduce `soldStock` si la venta ya estaba confirmada).
 *  - Si la decision es CREDIT: se crea un CustomerCredit con origin MANUAL.
 *  - Si el tipo es DAMAGE/LOSS en stock propio (sin pedido): se reduce `stock`
 *    y se crea InventoryMovement de tipo ADJUSTMENT.
 *
 * Devuelve el `incidentId`, el `creditId` (si se genero credito), y unidades
 * que fueron restock/ajustadas para inventarios.
 */
export async function createIncident(
  input: CreateIncidentInput,
): Promise<CreateIncidentResult> {
  const prisma = getPrisma();

  try {
    return await prisma.$transaction(
      async (tx) => {
        let variant: { id: string; stock: number; soldStock: number; reservedStock: number } | null =
          null;
        if (input.variantId) {
          const v = await tx.productVariant.findUnique({
            where: { id: input.variantId },
            select: { id: true, stock: true, soldStock: true, reservedStock: true },
          });
          if (!v) {
            throw new IncidentError(
              "La variante seleccionada ya no existe.",
              "VARIANT_NOT_FOUND",
            );
          }
          variant = v;
        }

        let order: { id: string; status: string; customerId: string } | null = null;
        if (input.orderId) {
          const o = await tx.order.findUnique({
            where: { id: input.orderId },
            select: { id: true, status: true, customerId: true },
          });
          if (!o) {
            throw new IncidentError(
              "El pedido seleccionado ya no existe.",
              "ORDER_NOT_FOUND",
            );
          }
          order = o;
        }

        if (input.orderItemId) {
          const item = await tx.orderItem.findUnique({
            where: { id: input.orderItemId },
            select: { id: true, orderId: true, quantity: true },
          });
          if (!item) {
            throw new IncidentError(
              "La linea de pedido seleccionada ya no existe.",
              "ITEM_NOT_FOUND",
            );
          }
          if (order && item.orderId !== order.id) {
            throw new IncidentError(
              "La linea de pedido no pertenece al pedido seleccionado.",
              "ITEM_NOT_FOUND",
            );
          }
        }

        if (input.customerId) {
          const customer = await tx.customer.findUnique({
            where: { id: input.customerId },
            select: { id: true },
          });
          if (!customer) {
            throw new IncidentError(
              "La clienta seleccionada ya no existe.",
              "CUSTOMER_NOT_FOUND",
            );
          }
        }

        const recoveredCents = input.recoveredAmount
          ? toCents(input.recoveredAmount, { allowNegative: true })
          : 0;
        const lostCents = input.lostAmount
          ? toCents(input.lostAmount, { allowNegative: true })
          : 0;
        if (recoveredCents < 0 || lostCents < 0) {
          throw new IncidentError(
            "Los montos no pueden ser negativos.",
            "INVALID_AMOUNT",
          );
        }

        const incident = await tx.incident.create({
          data: {
            incidentDate: new Date(input.incidentDate),
            type: input.type,
            status: "OPEN",
            decision: input.decision,
            orderId: input.orderId ?? null,
            orderItemId: input.orderItemId ?? null,
            variantId: input.variantId ?? null,
            customerId: input.customerId ?? null,
            quantity: input.quantity,
            description: input.description,
            recoveredAmount: centsToDecimalString(recoveredCents),
            lostAmount: centsToDecimalString(lostCents),
            restockQuantity: input.restockQuantity ?? 0,
            notes: input.notes ?? null,
            createdById: input.createdById,
          },
          select: { id: true },
        });

        let creditId: string | null = null;
        let restockedUnits = 0;
        let adjustedUnits = 0;

        // Integracion con stock segun tipo y decision.
        if (input.decision === "RESTOCK" && variant && (input.restockQuantity ?? 0) > 0) {
          const qty = input.restockQuantity ?? 0;
          if (qty > variant.soldStock) {
            // Si no hay unidades vendidas suficientes, devolvemos al stock
            // total lo que se pueda.
            const toSold = Math.min(qty, variant.soldStock);
            const toStock = qty - toSold;
            await tx.productVariant.update({
              where: { id: variant.id },
              data: {
                stock: { increment: toStock },
                soldStock: { decrement: toSold },
              },
            });
            if (toSold > 0) {
              await tx.inventoryMovement.create({
                data: {
                  variantId: variant.id,
                  type: "IN",
                  quantity: toSold,
                  reason: `Incidencia ${incident.id} - devolucion a stock`,
                },
              });
            }
            if (toStock > 0) {
              await tx.inventoryMovement.create({
                data: {
                  variantId: variant.id,
                  type: "IN",
                  quantity: toStock,
                  reason: `Incidencia ${incident.id} - devolucion a stock`,
                },
              });
            }
            restockedUnits = qty;
          } else {
            await tx.productVariant.update({
              where: { id: variant.id },
              data: {
                stock: { increment: qty },
                soldStock: { decrement: qty },
              },
            });
            await tx.inventoryMovement.create({
              data: {
                variantId: variant.id,
                type: "IN",
                quantity: qty,
                reason: `Incidencia ${incident.id} - devolucion a stock`,
              },
            });
            restockedUnits = qty;
          }
        } else if (
          (input.type === "DAMAGE" || input.type === "LOSS") &&
          variant &&
          !order
        ) {
          // Danio o perdida de inventario propio: ajustar stock hacia abajo.
          const qty = input.quantity;
          if (variant.stock < qty) {
            throw new IncidentError(
              `La variante solo tiene ${variant.stock} uds en stock.`,
              "INSUFFICIENT_STOCK",
            );
          }
          await tx.productVariant.update({
            where: { id: variant.id },
            data: { stock: { decrement: qty } },
          });
          await tx.inventoryMovement.create({
            data: {
              variantId: variant.id,
              type: "ADJUSTMENT",
              quantity: -qty,
              reason: `Incidencia ${incident.id} - ${input.type === "DAMAGE" ? "dano" : "perdida"}`,
            },
          });
          adjustedUnits = qty;
        }

        if (input.decision === "CREDIT" && input.customerId && recoveredCents > 0) {
          const credit = await tx.customerCredit.create({
            data: {
              customerId: input.customerId,
              origin: "MANUAL",
              status: "AVAILABLE",
              amount: centsToDecimalString(recoveredCents),
              availableAmount: centsToDecimalString(recoveredCents),
              notes: `Incidencia ${incident.id} - devolucion`,
              createdById: input.createdById,
            },
            select: { id: true },
          });
          creditId = credit.id;
          await tx.incident.update({
            where: { id: incident.id },
            data: { creditId: credit.id },
          });
          await auditInTx(tx, input.createdById, {
            action: "CREDIT_CREATED",
            entity: "CustomerCredit",
            entityId: credit.id,
            metadata: { origin: "INCIDENT", incidentId: incident.id },
          });
        }

        await auditInTx(tx, input.createdById, {
          action: "INCIDENT_CREATED",
          entity: "Incident",
          entityId: incident.id,
          metadata: {
            type: input.type,
            decision: input.decision,
            quantity: input.quantity,
            restockQuantity: input.restockQuantity ?? 0,
            adjustedUnits,
            restockedUnits,
            creditId,
            lostAmount: centsToDecimalString(lostCents),
            recoveredAmount: centsToDecimalString(recoveredCents),
          },
        });

        return {
          incidentId: incident.id,
          creditId,
          restockedUnits,
          adjustedUnits,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 15000,
      },
    );
  } catch (err) {
    if (err instanceof IncidentError) throw err;
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      (err.code === "P2034" || err.message.includes("serialization"))
    ) {
      throw new IncidentError(
        "Conflicto al registrar la incidencia. Intenta nuevamente.",
        "CONFLICT",
      );
    }
    throw err;
  }
}

export async function resolveIncident(input: {
  incidentId: string;
  actorId: string | null;
  resolutionNotes?: string | null;
}): Promise<{ incidentId: string }> {
  const prisma = getPrisma();
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.incident.findUnique({
        where: { id: input.incidentId },
        select: { id: true, status: true },
      });
      if (!existing) {
        throw new IncidentError("La incidencia ya no existe.", "INCIDENT_NOT_FOUND");
      }
      if (existing.status === "RESOLVED") {
        throw new IncidentError("La incidencia ya fue resuelta.", "ALREADY_RESOLVED");
      }
      if (existing.status === "CANCELLED") {
        throw new IncidentError(
          "La incidencia esta cancelada.",
          "ALREADY_CANCELLED",
        );
      }

      await tx.incident.update({
        where: { id: input.incidentId },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          resolvedById: input.actorId,
          resolutionNotes: input.resolutionNotes ?? null,
        },
      });

      await auditInTx(tx, input.actorId, {
        action: "INCIDENT_RESOLVED",
        entity: "Incident",
        entityId: input.incidentId,
        metadata: { resolutionNotes: input.resolutionNotes ?? null },
      });

      return { incidentId: input.incidentId };
    });
  } catch (err) {
    if (err instanceof IncidentError) throw err;
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      (err.code === "P2034" || err.message.includes("serialization"))
    ) {
      throw new IncidentError("Conflicto al resolver la incidencia.", "CONFLICT");
    }
    throw err;
  }
}

export async function cancelIncident(input: {
  incidentId: string;
  actorId: string | null;
  reason: string;
}): Promise<{ incidentId: string }> {
  const prisma = getPrisma();
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.incident.findUnique({
        where: { id: input.incidentId },
        select: { id: true, status: true },
      });
      if (!existing) {
        throw new IncidentError("La incidencia ya no existe.", "INCIDENT_NOT_FOUND");
      }
      if (existing.status === "RESOLVED") {
        throw new IncidentError(
          "No puedes cancelar una incidencia resuelta.",
          "ALREADY_RESOLVED",
        );
      }
      if (existing.status === "CANCELLED") {
        throw new IncidentError(
          "La incidencia ya esta cancelada.",
          "ALREADY_CANCELLED",
        );
      }

      await tx.incident.update({
        where: { id: input.incidentId },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelledById: input.actorId,
          cancelledReason: input.reason,
        },
      });

      await auditInTx(tx, input.actorId, {
        action: "INCIDENT_CANCELLED",
        entity: "Incident",
        entityId: input.incidentId,
        metadata: { reason: input.reason },
      });

      return { incidentId: input.incidentId };
    });
  } catch (err) {
    if (err instanceof IncidentError) throw err;
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      (err.code === "P2034" || err.message.includes("serialization"))
    ) {
      throw new IncidentError("Conflicto al cancelar la incidencia.", "CONFLICT");
    }
    throw err;
  }
}

// =====================================================================
// Agregadores para reportes y dashboard
// =====================================================================

export type IncidentMonthlySummary = {
  year: number;
  month: number;
  totalIncidents: number;
  lostCents: number;
  recoveredCents: number;
  netCents: number;
  lost: string;
  recovered: string;
  net: string;
  byType: Array<{
    type: IncidentType;
    count: number;
    lostCents: number;
    recoveredCents: number;
  }>;
};

export async function getMonthlyIncidentSummary(
  year: number,
  month: number,
): Promise<IncidentMonthlySummary> {
  const prisma = getPrisma();
  const { gte, lte } = monthRange(year, month);
  const where: Prisma.IncidentWhereInput = {
    status: { not: "CANCELLED" },
    incidentDate: { gte, lte },
  };

  const [lostAgg, recoveredAgg, byTypeRows, total] = await Promise.all([
    prisma.incident.aggregate({
      where,
      _sum: { lostAmount: true },
    }),
    prisma.incident.aggregate({
      where,
      _sum: { recoveredAmount: true },
    }),
    prisma.incident.groupBy({
      by: ["type"],
      where,
      _sum: { lostAmount: true, recoveredAmount: true },
      _count: { _all: true },
    }),
    prisma.incident.count({ where }),
  ]);

  const lostCents = toCents(lostAgg._sum.lostAmount);
  const recoveredCents = toCents(recoveredAgg._sum.recoveredAmount);
  const netCents = recoveredCents - lostCents;

  const byType = byTypeRows
    .map((row) => ({
      type: row.type,
      count: row._count._all,
      lostCents: toCents(row._sum.lostAmount),
      recoveredCents: toCents(row._sum.recoveredAmount),
    }))
    .sort((a, b) => b.lostCents - a.lostCents);

  return {
    year,
    month,
    totalIncidents: total,
    lostCents,
    recoveredCents,
    netCents,
    lost: centsToDecimalString(lostCents),
    recovered: centsToDecimalString(recoveredCents),
    net: centsToDecimalString(netCents),
    byType,
  };
}
