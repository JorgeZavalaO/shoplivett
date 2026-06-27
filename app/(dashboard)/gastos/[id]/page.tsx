import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Receipt, Edit } from "lucide-react";
import type { ExpenseCategory, ExpenseStatus, ExpenseType } from "@prisma/client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ExpenseStatusBadge } from "@/components/tables/expense-status-badge";
import { ExpenseForm } from "@/components/forms/expense-form";
import { VoidExpenseButton } from "@/components/forms/void-expense-button";
import { getExpenseDetailAction, updateExpenseAction, type ExpenseActionResult } from "@/actions/expenses";
import { requireRole } from "@/lib/permissions";
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_TYPE_LABELS,
} from "@/lib/expenses-shared";

type Params = Promise<{ id: string }>;

type ExpenseDetail = {
  id: string;
  expenseDate: Date;
  category: ExpenseCategory;
  expenseType: ExpenseType;
  status: ExpenseStatus;
  description: string;
  amount: { toString(): string };
  paymentMethod: string | null;
  notes: string | null;
  voidedAt: Date | null;
  voidReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { id: string; name: string; email: string } | null;
  voidedBy: { id: string; name: string; email: string } | null;
};

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  const expense = (await getExpenseDetailAction(id)) as ExpenseDetail | null;
  if (!expense) return { title: "Gasto no encontrado" };
  return { title: `Gasto · ${expense.description}` };
}

const DATE_FORMATTER = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "long",
});

const DATETIME_FORMATTER = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatPen(value: { toString(): string }): string {
  return `S/ ${Number(value.toString()).toFixed(2)}`;
}

function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function GastoDetailPage({
  params,
}: {
  params: Params;
}) {
  await requireRole(["ADMIN"]);
  const { id } = await params;
  const expense = (await getExpenseDetailAction(id)) as ExpenseDetail | null;
  if (!expense) notFound();

  const isVoided = expense.status === "VOIDED";
  const amount = formatPen(expense.amount);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          render={
            <Link href="/gastos">
              <ArrowLeft className="size-4" /> Volver
            </Link>
          }
        />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {expense.description}
            </h1>
            <ExpenseStatusBadge status={expense.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {EXPENSE_CATEGORY_LABELS[expense.category]} ·{" "}
            {EXPENSE_TYPE_LABELS[expense.expenseType]}
          </p>
        </div>
        {!isVoided ? (
          <VoidExpenseButton expenseId={expense.id} />
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Monto</p>
          <p
            className={
              "mt-1 text-2xl font-semibold font-mono " +
              (isVoided ? "text-muted-foreground line-through" : "")
            }
          >
            {amount}
          </p>
          <p className="text-xs text-muted-foreground">
            {DATE_FORMATTER.format(new Date(expense.expenseDate))}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Medio de pago</p>
          <p className="mt-1 text-base font-medium">
            {expense.paymentMethod ?? "-"}
          </p>
          <p className="text-xs text-muted-foreground">
            Categoria: {EXPENSE_CATEGORY_LABELS[expense.category]}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Tipo</p>
          <p className="mt-1 text-base font-medium">
            {EXPENSE_TYPE_LABELS[expense.expenseType]}
          </p>
          <p className="text-xs text-muted-foreground">
            Creado por {expense.createdBy?.name ?? "Sistema"}
          </p>
        </div>
      </div>

      {isVoided && (
        <div className="flex flex-col gap-1 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            Gasto anulado
          </p>
          <p className="text-xs text-amber-800 dark:text-amber-300">
            {expense.voidedAt
              ? `Anulado el ${DATETIME_FORMATTER.format(new Date(expense.voidedAt))} por ${expense.voidedBy?.name ?? "sistema"}.`
              : "Anulado."}
          </p>
          {expense.voidReason ? (
            <p className="text-xs text-amber-900 dark:text-amber-200">
              Motivo: {expense.voidReason}
            </p>
          ) : null}
        </div>
      )}

      {expense.notes ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Notas</p>
          <p className="mt-1 text-sm whitespace-pre-wrap">{expense.notes}</p>
        </div>
      ) : null}

      {!isVoided ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Edit className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Editar gasto</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ExpenseForm
              mode="edit"
              action={((prev: ExpenseActionResult | undefined, formData: FormData) =>
                updateExpenseAction(expense.id, prev, formData)
              ) as (
                prev: ExpenseActionResult | undefined,
                formData: FormData,
              ) => Promise<ExpenseActionResult>}
              cancelHref={`/gastos/${expense.id}`}
              defaultValues={{
                expenseDate: toDateInput(new Date(expense.expenseDate)),
                category: expense.category,
                expenseType: expense.expenseType,
                description: expense.description,
                amount: expense.amount.toString(),
                paymentMethod: expense.paymentMethod,
                notes: expense.notes,
              }}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Receipt className="size-4" />
          Los gastos anulados no pueden editarse. Crea uno nuevo si necesitas
          registrarlo de nuevo.
        </div>
      )}
    </div>
  );
}
