import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import type { ExpenseCategory, ExpenseStatus, ExpenseType } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { ExpensesTable } from "@/components/tables/expenses-table";
import { requirePermission } from "@/lib/authorization";
import { listExpensesAction } from "@/actions/expenses";
import {
  EXPENSE_CATEGORY_OPTIONS,
  EXPENSE_TYPE_OPTIONS,
} from "@/lib/expenses-shared";
import type { ExpenseCategory as PrismaExpenseCategory, ExpenseStatus as PrismaExpenseStatus, ExpenseType as PrismaExpenseType } from "@prisma/client";

export const metadata: Metadata = { title: "Gastos operativos" };

const VALID_CATEGORIES = new Set<string>(
  EXPENSE_CATEGORY_OPTIONS.map((c) => c.value),
);
const VALID_TYPES = new Set<string>(EXPENSE_TYPE_OPTIONS.map((t) => t.value));
const VALID_STATUS: PrismaExpenseStatus[] = ["ACTIVE", "VOIDED"];

type SearchParams = Promise<{
  q?: string | string[];
  page?: string | string[];
  category?: string | string[];
  status?: string | string[];
  type?: string | string[];
  year?: string | string[];
  month?: string | string[];
}>;

function first<T = string>(v: T | T[] | undefined): T | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function GastosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePermission("expenses.read");
  const sp = await searchParams;

  const q = first(sp.q) ?? "";
  const page = Math.max(1, Number(first(sp.page)) || 1);

  const categoryRaw = first(sp.category) ?? "ALL";
  const category: ExpenseCategory | "ALL" = VALID_CATEGORIES.has(categoryRaw)
    ? (categoryRaw as ExpenseCategory)
    : "ALL";

  const statusRaw = first(sp.status) ?? "ALL";
  const status: ExpenseStatus | "ALL" = (VALID_STATUS as string[]).includes(statusRaw)
    ? (statusRaw as ExpenseStatus)
    : "ALL";

  const typeRaw = first(sp.type) ?? "ALL";
  const type: ExpenseType | "ALL" = VALID_TYPES.has(typeRaw)
    ? (typeRaw as ExpenseType)
    : "ALL";

  const yearRaw = Number(first(sp.year));
  const monthRaw = Number(first(sp.month));
  const year = Number.isFinite(yearRaw) && yearRaw > 1970 ? yearRaw : undefined;
  const month =
    Number.isFinite(monthRaw) && monthRaw >= 1 && monthRaw <= 12
      ? monthRaw
      : undefined;

  const result = await listExpensesAction({
    query: q,
    category: category as PrismaExpenseCategory | "ALL",
    status: status as PrismaExpenseStatus | "ALL",
    type: type as PrismaExpenseType | "ALL",
    year,
    month,
    page,
    perPage: 20,
  });

  const rows = result.items.map((it) => ({
    id: it.id,
    expenseDate: it.expenseDate,
    category: it.category,
    expenseType: it.expenseType,
    status: it.status,
    description: it.description,
    amount: { toString: () => it.amount.toString() },
    paymentMethod: it.paymentMethod,
    createdBy: it.createdBy,
  }));

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gastos operativos</h1>
          <p className="text-sm text-muted-foreground">
            Registra los egresos mensuales del negocio y manten el control de la
            publicidad y gastos fijos.
          </p>
        </div>
        <Button
          render={
            <Link href="/gastos/nuevo">
              <Plus className="size-4" /> Nuevo gasto
            </Link>
          }
        />
      </div>

      <FilterBar
        query={q}
        category={result.category}
        status={result.status}
        type={result.type}
        month={result.month}
      />

      <ExpensesTable
        items={rows}
        total={result.total}
        page={result.page}
        perPage={result.perPage}
        query={result.query}
        category={result.category}
        status={result.status}
        type={result.type}
        month={result.month}
        totalAmount={result.totalAmount}
      />
    </div>
  );
}

function FilterBar({
  query,
  category,
  status,
  type,
  month,
}: {
  query: string;
  category: ExpenseCategory | "ALL";
  status: ExpenseStatus | "ALL";
  type: ExpenseType | "ALL";
  month: { year: number; month: number } | null;
}) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (category !== "ALL") params.set("category", category);
  if (status !== "ALL") params.set("status", status);
  if (type !== "ALL") params.set("type", type);
  if (month) {
    params.set("year", String(month.year));
    params.set("month", String(month.month));
  }
  const qs = params.toString();
  const base = qs ? `/gastos?${qs}` : "/gastos";

  return (
    <form
      method="GET"
      action="/gastos"
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 md:flex-row md:flex-wrap md:items-end"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="q" className="text-xs text-muted-foreground">
          Buscar
        </label>
        <input
          id="q"
          name="q"
          defaultValue={query}
          placeholder="Detalle, nota o medio de pago"
          className="h-8 w-56 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="category" className="text-xs text-muted-foreground">
          Categoria
        </label>
        <select
          id="category"
          name="category"
          defaultValue={category}
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="ALL">Todas</option>
          {EXPENSE_CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="type" className="text-xs text-muted-foreground">
          Tipo
        </label>
        <select
          id="type"
          name="type"
          defaultValue={type}
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="ALL">Todos</option>
          {EXPENSE_TYPE_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="status" className="text-xs text-muted-foreground">
          Estado
        </label>
        <select
          id="status"
          name="status"
          defaultValue={status}
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="ALL">Todos</option>
          <option value="ACTIVE">Activos</option>
          <option value="VOIDED">Anulados</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="month" className="text-xs text-muted-foreground">
          Mes
        </label>
        <input
          id="month"
          name="month"
          type="month"
          defaultValue={
            month
              ? `${month.year}-${String(month.month).padStart(2, "0")}`
              : ""
          }
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <div className="flex items-end gap-2">
        <button
          type="submit"
          className="h-8 rounded-md border border-transparent bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80"
        >
          Filtrar
        </button>
        <a
          href={base}
          className="h-8 rounded-md border border-border bg-background px-3 text-sm hover:bg-muted inline-flex items-center"
        >
          Limpiar
        </a>
      </div>
    </form>
  );
}
