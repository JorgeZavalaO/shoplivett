// Servicio de auditoría.
//
// Filosofía:
// 1. La auditoría de eventos NO críticos se encola con `unstable_after` para
//    no bloquear la respuesta HTTP (importante en serverless).
// 2. La auditoría de eventos financieros/críticos debe quedar en la misma
//    transacción de Prisma que el cambio que registra, para no perder
//    consistencia si la operación principal falla.
// 3. La tabla AuditLog es inmutable: no exponer update/delete desde la UI.
//
// Helpers expuestos:
// - `auditAfter()`:    usar cuando la acción principal YA confirmó el cambio.
// - `auditInTx(tx)`:   usar dentro de transacciones para eventos financieros.

import { Prisma, type PrismaClient, type AuditAction } from "@prisma/client";
import { after } from "next/server";

import { getPrisma } from "@/lib/prisma";

export type { AuditAction };

type PrismaTx = Prisma.TransactionClient | PrismaClient;

export type AuditEvent = {
  action: AuditAction;
  entity: string;
  entityId: string;
  actorId: string | null;
  metadata?: Record<string, unknown> | null;
};

export type Auditable = {
  action: AuditAction;
  entity: string;
  entityId: string;
  metadata?: Record<string, unknown> | null;
};

async function writeAudit(
  tx: PrismaTx,
  event: AuditEvent,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      action: event.action,
      entity: event.entity,
      entityId: event.entityId,
      actorId: event.actorId,
      metadata: event.metadata
        ? (event.metadata as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    },
  });
}

/**
 * Audita dentro de una transacción de Prisma. Usar SOLO cuando la integridad
 * del evento requiera estar atado a la operación principal (pagos, créditos,
 * cancelaciones, etc.). Para el resto, usar `auditAfter`.
 */
export async function auditInTx(
  tx: PrismaTx,
  actorId: string | null,
  event: Auditable,
): Promise<void> {
  await writeAudit(tx, { ...event, actorId });
}

/**
 * Audita después de enviar la respuesta. No bloquea al usuario. Pensado para
 * eventos no críticos (cambios de estado de shipment, ajustes secundarios, etc.)
 * o cuando la acción ya confirmó y la auditoría es sólo informativa.
 */
export function auditAfter(
  actorId: string | null,
  event: Auditable,
): void {
  after(async () => {
    try {
      await writeAudit(getPrisma(), { ...event, actorId });
    } catch (err) {
      // No propagamos: la respuesta ya fue enviada y un fallo de auditoría
      // no debe romper nada. En producción esto debería ir a un logger.
      console.error("[auditAfter] failed", err);
    }
  });
}
