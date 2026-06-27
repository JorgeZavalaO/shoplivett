"use client";

import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { ExpenseStatusBadge } from "@/components/tables/expense-status-badge";
import { PaginatedDataTable } from "@/components/tables/paginated-data-table";
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_TYPE_LABELS,
} from "@/lib/expenses-shared";
import type { ExpenseCategory, ExpenseStatus, ExpenseType } from "@prisma/client";

export type ExpenseRow = {
  id: string;
  expenseDate: Date;
  category: ExpenseCategory;
  expenseType: ExpenseType;
  status: ExpenseStatus;
  description: string;
  amount: { toString(): string };
  paymentMethod: string | null;
  createdBy: { id: string; name: string } | null;
};

type Props = {
  items: ExpenseRow[];
  total: number;
  page: number;
  perPage: number;
  query: string;
  category: ExpenseCategory | "ALL";
  status: ExpenseStatus | "ALL";
  type: ExpenseType | "ALL";
  month: { year: number; month: number } | null;
  totalAmount: string;
};

const columns: ColumnDef<ExpenseRow>[] = [
  {
    header: "Fecha",
    cell: ({ row }) =>
      new Intl.DateTimeFormat("es-PE", { dateStyle: "short" }).format(
        new Date(row.original.expenseDate),
      ),
  },
  {
    accessorKey: "description",
    header: "Detalle",
    cell: ({ row }) => (
      <Link
        href={`/gastos/${row.original.id}`}
        className="font-medium hover:underline"
      >
        {row.original.description}
      </Link>
    ),
  },
  {
    accessorKey: "category",
    header: "Categoria",
    cell: ({ row }) => EXPENSE_CATEGORY_LABELS[row.original.category],
  },
  {
    accessorKey: "expenseType",
    header: "Tipo",
    cell: ({ row }) => EXPENSE_TYPE_LABELS[row.original.expenseType],
  },
  {
    header: "Medio",
    cell: ({ row }) =>
      row.original.paymentMethod ? (
        <span className="text-xs">{row.original.paymentMethod}</span>
      ) : (
        <span className="text-xs text-muted-foreground">-</span>
      ),
  },
  {
    header: "Monto",
    cell: ({ row }) => {
      const isVoided = row.original.status === "VOIDED";
      return (
        <span
          className={
            "font-mono text-sm " +
            (isVoided ? "text-muted-foreground line-through" : "font-semibold")
          }
        >
          S/ {Number(row.original.amount.toString()).toFixed(2)}
        </span>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Estado",
    cell: ({ row }) => <ExpenseStatusBadge status={row.original.status} />,
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        render={<Link href={`/gastos/${row.original.id}`}>Ver</Link>}
      />
    ),
  },
];

export function ExpensesTable({
  items,
  total,
  page,
  perPage,
  query,
  category,
  status,
  type,
  month,
  totalAmount,
}: Props) {
  return (
    <div className="flex flex-col gap-4">
      <PaginatedDataTable
        items={items}
        total={total}
        page={page}
        perPage={perPage}
        columns={columns}
        searchPlaceholder="Buscar por detalle, nota o medio de pago…"
        query={query}
        emptyMessage="Aun no hay gastos registrados."
        queryEmptyMessage={`No se encontraron gastos con "${query}".`}
      />

      <div className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            Filtros aplicados
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <FilterChip
              label={`Categoria: ${category === "ALL" ? "Todas" : EXPENSE_CATEGORY_LABELS[category]}`}
            />
            <FilterChip
              label={`Tipo: ${type === "ALL" ? "Todos" : EXPENSE_TYPE_LABELS[type]}`}
            />
            <FilterChip
              label={`Estado: ${status === "ALL" ? "Todos" : status === "ACTIVE" ? "Activos" : "Anulados"}`}
            />
            {month ? (
              <FilterChip
                label={`Periodo: ${String(month.month).padStart(2, "0")}/${month.year}`}
              />
            ) : (
              <FilterChip label="Periodo: Todos" />
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <p className="text-xs text-muted-foreground">Total activo (pagina)</p>
          <p className="text-2xl font-semibold font-mono">S/ {totalAmount}</p>
        </div>
      </div>
    </div>
  );
}

function FilterChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-xs">
      {label}
    </span>
  );
}
