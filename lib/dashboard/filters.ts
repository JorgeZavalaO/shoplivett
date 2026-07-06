import { SalesChannel } from "@prisma/client";

import { getPrisma } from "@/lib/prisma";

export type FilterOption = { value: string; label: string };

export async function listBatchOptions(): Promise<FilterOption[]> {
  const prisma = getPrisma();
  const rows = await prisma.importBatch.findMany({
    where: { status: { in: ["PURCHASED", "IN_TRANSIT", "COMPLETE", "CLOSED"] } },
    select: { id: true, code: true, status: true, purchaseDate: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return [
    { value: "ALL", label: "Todos los lotes" },
    ...rows.map((r) => ({
      value: r.id,
      label: `${r.code} · ${r.status} · ${r.purchaseDate.toISOString().slice(0, 10)}`,
    })),
  ];
}

export async function listCategoryOptionsForFilter(): Promise<FilterOption[]> {
  const prisma = getPrisma();
  const rows = await prisma.category.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return [
    { value: "ALL", label: "Todas las categorías" },
    ...rows.map((r) => ({ value: r.id, label: r.name })),
  ];
}

export const SALES_CHANNEL_FILTER_OPTIONS: FilterOption[] = [
  { value: "ALL", label: "Todos los canales" },
  ...Object.values(SalesChannel).map((c) => ({ value: c, label: c })),
];

export function safeSalesChannel(value: unknown): SalesChannel | "ALL" {
  if (typeof value !== "string") return "ALL";
  if (value === "ALL") return "ALL";
  if ((Object.values(SalesChannel) as string[]).includes(value)) {
    return value as SalesChannel;
  }
  return "ALL";
}

export function safeAllString(value: unknown, fallback = "ALL"): string {
  if (typeof value !== "string") return fallback;
  if (value === "") return fallback;
  return value;
}

export function safeYearMonth(
  yearRaw: unknown,
  monthRaw: unknown,
): { year: number; month: number } {
  const now = new Date();
  const current = { year: now.getFullYear(), month: now.getMonth() + 1 };
  const yearNum = Number(yearRaw);
  const monthNum = Number(monthRaw);
  const year =
    Number.isInteger(yearNum) && yearNum >= 2000 && yearNum <= 2100
      ? yearNum
      : current.year;
  const month =
    Number.isInteger(monthNum) && monthNum >= 1 && monthNum <= 12
      ? monthNum
      : current.month;
  return { year, month };
}
