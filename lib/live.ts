import { LiveStatus, Prisma } from "@prisma/client";

import { getPrisma } from "@/lib/prisma";

export class LiveError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "LIVE_NOT_FOUND"
      | "LIVE_NOT_OPEN"
      | "LIVE_ALREADY_OPEN"
      | "LIVE_ALREADY_CLOSED"
      | "LIVE_ALREADY_CANCELLED"
      | "LIVE_NOT_EDITABLE",
  ) {
    super(message);
    this.name = "LiveError";
  }
}

export async function getOpenLive() {
  return getPrisma().liveSession.findFirst({
    where: { status: "OPEN" },
    orderBy: { startedAt: "desc" },
    include: {
      responsible: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });
}

export async function canOpenNewLive(): Promise<boolean> {
  const open = await getOpenLive();
  return !open;
}

export async function assertLiveIsOpen(liveId: string) {
  const live = await getPrisma().liveSession.findUnique({
    where: { id: liveId },
  });
  if (!live) {
    throw new LiveError("El live ya no existe.", "LIVE_NOT_FOUND");
  }
  if (live.status !== "OPEN") {
    throw new LiveError(
      "El live no está abierto para registrar ventas.",
      "LIVE_NOT_OPEN",
    );
  }
  return live;
}

export async function listLiveSessions(args?: {
  query?: string;
  status?: LiveStatus | "ALL";
  page?: number;
  perPage?: number;
}) {
  const safePage = Math.max(1, args?.page ?? 1);
  const safePerPage = Math.min(100, Math.max(1, args?.perPage ?? 20));
  const query = args?.query?.trim() ?? "";
  const status = args?.status ?? "ALL";

  const where: Prisma.LiveSessionWhereInput = {
    ...(status !== "ALL" ? { status } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { notes: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const prisma = getPrisma();
  const [total, items] = await Promise.all([
    prisma.liveSession.count({ where }),
    prisma.liveSession.findMany({
      where,
      orderBy: [{ startedAt: "desc" }, { createdAt: "desc" }],
      skip: (safePage - 1) * safePerPage,
      take: safePerPage,
      include: {
        responsible: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    }),
  ]);

  return {
    items,
    total,
    page: safePage,
    perPage: safePerPage,
    query,
    status,
  };
}

export async function getLiveMetrics(_liveId: string) {
  void _liveId;
  return {
    ordersCount: 0,
    soldAmount: "0.00",
    collectedAmount: "0.00",
    pendingAmount: "0.00",
  };
}

export async function getLiveDetail(liveId: string) {
  const prisma = getPrisma();
  const live = await prisma.liveSession.findUnique({
    where: { id: liveId },
    include: {
      responsible: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });
  if (!live) {
    throw new LiveError("El live ya no existe.", "LIVE_NOT_FOUND");
  }
  const metrics = await getLiveMetrics(liveId);
  return { live, metrics };
}

export async function assertCanOpenLive() {
  const open = await getOpenLive();
  if (open) {
    throw new LiveError(
      "Ya existe un live abierto. Ciérralo o cancélalo antes de abrir otro.",
      "LIVE_ALREADY_OPEN",
    );
  }
}
