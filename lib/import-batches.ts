import { getPrisma } from "@/lib/prisma";
import type { ImportBatchStatus, Prisma } from "@prisma/client";

export { IMPORT_BATCH_STATUS_LABELS, BATCH_STATUS_OPTIONS } from "@/lib/import-batches-shared";

const PADDING = 3;

export function buildBatchCode(year: number, sequential: number): string {
  return `LOTE-${year}-${String(sequential).padStart(PADDING, "0")}`;
}

export async function nextBatchCode(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const prefix = `LOTE-${year}-`;

  const prisma = getPrisma();
  const last = await prisma.importBatch.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });

  let nextSeq = 1;
  if (last) {
    const tail = last.code.slice(prefix.length);
    const n = Number.parseInt(tail, 10);
    if (Number.isFinite(n)) nextSeq = n + 1;
  }
  return buildBatchCode(year, nextSeq);
}

/**
 * Genera un código de lote intentando generar uno nuevo si el anterior
 * colisiona con uno existente. Usado por createBatchAction para manejar
 * concurrencia entre requests simultáneos.
 */
export async function nextBatchCodeWithRetry(maxAttempts = 5): Promise<string> {
  let lastCode = await nextBatchCode();
  for (let i = 0; i < maxAttempts; i++) {
    const prisma = getPrisma();
    const exists = await prisma.importBatch.findUnique({
      where: { code: lastCode },
      select: { id: true },
    });
    if (!exists) return lastCode;
    const m = lastCode.match(/^(LOTE-\d{4}-)(\d+)$/);
    if (!m) return lastCode;
    const prefix = m[1];
    const seq = Number.parseInt(m[2], 10) + 1;
    lastCode = `${prefix}${String(seq).padStart(PADDING, "0")}`;
  }
  return lastCode;
}

export const BATCH_LIST_SELECT = {
  id: true,
  code: true,
  purchaseDate: true,
  shopper: true,
  agency: true,
  totalCostUsd: true,
  totalAdditionalCostsUsd: true,
  totalAdditionalCostsPen: true,
  exchangeRate: true,
  totalInvestmentPen: true,
  status: true,
  createdAt: true,
  createdBy: { select: { id: true, name: true } },
  _count: { select: { items: true } },
} as const;

export const BATCH_DETAIL_SELECT = {
  id: true,
  code: true,
  purchaseDate: true,
  shopper: true,
  agency: true,
  totalCostUsd: true,
  totalAdditionalCostsUsd: true,
  totalAdditionalCostsPen: true,
  exchangeRate: true,
  totalInvestmentPen: true,
  status: true,
  distributionMethod: true,
  distributionBreakdown: true,
  lastRecalculatedAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true } },
  items: {
    select: {
      id: true,
      quantityPurchased: true,
      quantityReceived: true,
      quantityAvailable: true,
      unitCostUsd: true,
      unitCostPen: true,
      weight: true,
      subtotalUsd: true,
      subtotalPen: true,
      additionalSubtotalPen: true,
      additionalCostPen: true,
      landedUnitCostPen: true,
      landedSubtotalPen: true,
      distributionBreakdown: true,
      calculatedAt: true,
      variant: {
        select: {
          id: true,
          code: true,
          color: true,
          price: true,
          stock: true,
          product: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  },
} as const;

export async function listBatches(
  query: string,
  status: string,
  page: number,
  perPage: number,
) {
  const prisma = getPrisma();
  const trimmed = query.trim();
  const safePage = Math.max(1, Math.floor(page));
  const safePerPage = Math.min(100, Math.max(1, Math.floor(perPage)));

  const where: Prisma.ImportBatchWhereInput = {};
  if (status && status !== "ALL") {
    where.status = status as ImportBatchStatus;
  }
  if (trimmed) {
    where.OR = [
      { code: { contains: trimmed, mode: "insensitive" } },
      { shopper: { contains: trimmed, mode: "insensitive" } },
      { agency: { contains: trimmed, mode: "insensitive" } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.importBatch.count({ where }),
    prisma.importBatch.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safePerPage,
      take: safePerPage,
      select: BATCH_LIST_SELECT,
    }),
  ]);

  return {
    items,
    total,
    page: safePage,
    perPage: safePerPage,
    query: trimmed,
    status: status || "ALL",
  };
}

export async function getBatchDetail(id: string) {
  const prisma = getPrisma();
  return prisma.importBatch.findUnique({
    where: { id },
    select: BATCH_DETAIL_SELECT,
  });
}

export function batchToCents(value: string | number | { toString(): string } | null | undefined) {
  const n = value == null ? 0 : Number(value.toString());
  return Math.round(n * 100);
}
