import type { Metadata } from "next";

import { ExpenseForm } from "@/components/forms/expense-form";
import { createExpenseAction, type ExpenseActionResult } from "@/actions/expenses";
import { requireRole } from "@/lib/permissions";

export const metadata: Metadata = { title: "Nuevo gasto" };

export default async function NuevoGastoPage() {
  await requireRole(["ADMIN"]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo gasto</h1>
        <p className="text-sm text-muted-foreground">
          Registra un egreso para el periodo. Las categorias predefinidas cubren
          publicidad, sueldos, alquiler, servicios y mas.
        </p>
      </div>
      <ExpenseForm
        mode="create"
        action={
          createExpenseAction as (
            prev: ExpenseActionResult | undefined,
            formData: FormData,
          ) => Promise<ExpenseActionResult>
        }
        cancelHref="/gastos"
      />
    </div>
  );
}
