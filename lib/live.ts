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

export async function getLiveMetrics(liveId: string) {
  const prisma = getPrisma();
  const orders = await prisma.order.findMany({
    where: { liveSessionId: liveId },
    select: {
      total: true,
      validatedPaid: true,
      balance: true,
      status: true,
    },
  });

  let soldCents = 0;
  let collectedCents = 0;
  let pendingCents = 0;

  for (const o of orders) {
    const totalCents = toCents(o.total.toString());
    const validatedCents = toCents(o.validatedPaid.toString());
    const balanceCents = toCents(o.balance.toString());
    soldCents += totalCents;
    if (o.status === "PAID" || o.status === "PARTIALLY_PAID" || o.status === "RESERVED") {
      collectedCents += validatedCents;
      pendingCents += balanceCents;
    } else if (o.status === "PAYMENT_VALIDATION_PENDING") {
      pendingCents += totalCents;
    }
  }

  return {
    ordersCount: orders.length,
    soldAmount: centsToDecimalString(soldCents),
    collectedAmount: centsToDecimalString(collectedCents),
    pendingAmount: centsToDecimalString(pendingCents),
  };
}

function toCents(value: string): number {
  const [whole, fraction = ""] = value.trim().split(".");
  const safeWhole = (whole || "0").replace(/[^0-9]/g, "") || "0";
  const safeFraction = (fraction || "").replace(/[^0-9]/g, "").padEnd(2, "0").slice(0, 2);
  return Number(safeWhole) * 100 + Number(safeFraction);
}

function centsToDecimalString(cents: number): string {
  const negative = cents < 0;
  const abs = negative ? -cents : cents;
  const whole = Math.trunc(abs / 100);
  const fraction = Math.trunc(abs % 100);
  const fracStr = String(fraction).padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fracStr}`;
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
