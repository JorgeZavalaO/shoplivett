// Capa de lectura para el módulo de auditoría (Sprint 14).
// Sólo expone listados y agregaciones; nunca update/delete.

import { type AuditAction, type Prisma } from "@prisma/client";

import { getPrisma } from "@/lib/prisma";

export type AuditLogItem = {
  id: string;
  action: AuditAction;
  entity: string;
  entityId: string;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
};

export type AuditLogFilter = {
  from?: Date | null;
  to?: Date | null;
  action?: AuditAction | "ALL";
  entity?: string | "ALL";
  actorId?: string;
  query?: string;
  page?: number;
  perPage?: number;
};

const ZERO = 0;

export type AuditLogListResult = {
  items: AuditLogItem[];
  total: number;
  page: number;
  perPage: number;
  byAction: Array<{ action: AuditAction; count: number }>;
  byEntity: Array<{ entity: string; count: number }>;
};

export async function listAuditLog(
  filter: AuditLogFilter,
): Promise<AuditLogListResult> {
  const prisma = getPrisma();
  const safePage = Math.max(1, filter.page ?? 1);
  const safePerPage = Math.min(100, Math.max(1, filter.perPage ?? 25));
  const query = filter.query?.trim() ?? "";
  const createdAt: Prisma.AuditLogWhereInput["createdAt"] = {};
  if (filter.from) createdAt.gte = filter.from;
  if (filter.to) createdAt.lte = filter.to;

  const where: Prisma.AuditLogWhereInput = {
    ...(Object.keys(createdAt).length > 0 ? { createdAt } : {}),
    ...(filter.action && filter.action !== "ALL" ? { action: filter.action } : {}),
    ...(filter.entity && filter.entity !== "ALL" ? { entity: filter.entity } : {}),
    ...(filter.actorId ? { actorId: filter.actorId } : {}),
    ...(query
      ? {
          OR: [
            { entityId: { contains: query, mode: "insensitive" } },
            { entity: { contains: query, mode: "insensitive" } },
            {
              actor: {
                is: { email: { contains: query, mode: "insensitive" } },
              },
            },
            {
              actor: {
                is: { name: { contains: query, mode: "insensitive" } },
              },
            },
          ],
        }
      : {}),
  };

  const [total, rows, byActionRows, byEntityRows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safePerPage,
      take: safePerPage,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        actorId: true,
        metadata: true,
        createdAt: true,
        actor: { select: { name: true, email: true } },
      },
    }),
    prisma.auditLog.groupBy({
      where,
      by: ["action"],
      _count: { _all: true },
    }),
    prisma.auditLog.groupBy({
      where,
      by: ["entity"],
      _count: { _all: true },
    }),
  ]);

  const items: AuditLogItem[] = rows.map((r) => ({
    id: r.id,
    action: r.action,
    entity: r.entity,
    entityId: r.entityId,
    actorId: r.actorId,
    actorName: r.actor?.name ?? null,
    actorEmail: r.actor?.email ?? null,
    metadata: r.metadata as Prisma.JsonValue | null,
    createdAt: r.createdAt,
  }));

  return {
    items,
    total,
    page: safePage,
    perPage: safePerPage,
    byAction: byActionRows
      .map((r) => ({ action: r.action, count: r._count._all }))
      .sort((a, b) => b.count - a.count),
    byEntity: byEntityRows
      .map((r) => ({ entity: r.entity, count: r._count._all }))
      .sort((a, b) => b.count - a.count),
  };
}

export type AuditActorOption = {
  id: string;
  name: string | null;
  email: string | null;
};

export async function listAuditActors(): Promise<AuditActorOption[]> {
  const prisma = getPrisma();
  const rows = await prisma.user.findMany({
    where: { auditLogs: { some: {} } },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
  return rows;
}

export type AuditActionCount = { action: AuditAction; count: number };

export async function countAuditByAction(
  filter: Pick<AuditLogFilter, "from" | "to"> = {},
): Promise<AuditActionCount[]> {
  const prisma = getPrisma();
  const createdAt: Prisma.AuditLogWhereInput["createdAt"] = {};
  if (filter.from) createdAt.gte = filter.from;
  if (filter.to) createdAt.lte = filter.to;
  const where: Prisma.AuditLogWhereInput = {
    ...(Object.keys(createdAt).length > 0 ? { createdAt } : {}),
  };
  const rows = await prisma.auditLog.groupBy({
    where,
    by: ["action"],
    _count: { _all: true },
  });
  return rows
    .map((r) => ({ action: r.action, count: r._count._all }))
    .sort((a, b) => b.count - a.count);
}

export const ZERO_INT = ZERO;
