"use client";

import { useActionState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/ui/submit-button";
import { FieldError } from "@/components/ui/field-error";
import { FormMessage } from "@/components/ui/form-message";
import { CancelLink } from "@/components/ui/cancel-link";
import type { ExpenseActionResult } from "@/actions/expenses";
import {
  EXPENSE_CATEGORY_OPTIONS,
  EXPENSE_TYPE_OPTIONS,
} from "@/lib/expenses-shared";
import type { ExpenseCategory, ExpenseType } from "@prisma/client";

const initialState: ExpenseActionResult = { ok: false };

type Props = {
  mode: "create" | "edit";
  action: (
    prev: ExpenseActionResult | undefined,
    formData: FormData,
  ) => Promise<ExpenseActionResult>;
  cancelHref: string;
  defaultValues?: {
    expenseDate: string;
    category: ExpenseCategory;
    expenseType: ExpenseType;
    description: string;
    amount: string;
    paymentMethod: string | null;
    notes: string | null;
  };
};

export function ExpenseForm({
  mode,
  action,
  cancelHref,
  defaultValues,
}: Props) {
  const [state, formAction] = useActionState<ExpenseActionResult, FormData>(
    action,
    initialState,
  );

  const today = new Date().toISOString().split("T")[0];

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informacion del gasto</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="expenseDate" className="text-sm font-medium">
              Fecha *
            </label>
            <Input
              id="expenseDate"
              name="expenseDate"
              type="date"
              required
              defaultValue={defaultValues?.expenseDate ?? today}
              aria-invalid={Boolean(state.fieldErrors?.expenseDate)}
            />
            <FieldError message={state.fieldErrors?.expenseDate} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="category" className="text-sm font-medium">
              Categoria *
            </label>
            <select
              id="category"
              name="category"
              required
              defaultValue={defaultValues?.category ?? "OTHER"}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-invalid={Boolean(state.fieldErrors?.category)}
            >
              {EXPENSE_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <FieldError message={state.fieldErrors?.category} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="expenseType" className="text-sm font-medium">
              Tipo *
            </label>
            <select
              id="expenseType"
              name="expenseType"
              required
              defaultValue={defaultValues?.expenseType ?? "VARIABLE"}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {EXPENSE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="amount" className="text-sm font-medium">
              Monto (S/) *
            </label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              defaultValue={defaultValues?.amount ?? ""}
              placeholder="0.00"
              className="font-mono"
              aria-invalid={Boolean(state.fieldErrors?.amount)}
            />
            <FieldError message={state.fieldErrors?.amount} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="paymentMethod" className="text-sm font-medium">
              Medio de pago
            </label>
            <Input
              id="paymentMethod"
              name="paymentMethod"
              maxLength={40}
              defaultValue={defaultValues?.paymentMethod ?? ""}
              placeholder="Yape, Plin, transferencia..."
            />
          </div>

          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label htmlFor="description" className="text-sm font-medium">
              Detalle *
            </label>
            <Input
              id="description"
              name="description"
              required
              maxLength={200}
              defaultValue={defaultValues?.description ?? ""}
              placeholder="Descripcion corta del gasto"
              aria-invalid={Boolean(state.fieldErrors?.description)}
            />
            <FieldError message={state.fieldErrors?.description} />
          </div>

          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label htmlFor="notes" className="text-sm font-medium">
              Notas
            </label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              maxLength={1000}
              defaultValue={defaultValues?.notes ?? ""}
              placeholder="Notas adicionales (opcional)"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <FormMessage ok={state.ok} message={state.message} />
        <div className="flex items-center gap-2">
          <CancelLink href={cancelHref} />
          <SubmitButton label={mode === "create" ? "Registrar gasto" : "Guardar cambios"} />
        </div>
      </div>
    </form>
  );
}
