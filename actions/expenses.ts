"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import type { ZodIssue } from "zod";

import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import {
  ExpenseCreateSchema,
  ExpenseUpdateSchema,
  ExpenseVoidSchema,
  type ExpenseCreateInput,
} from "@/lib/validations";
import { auditInTx } from "@/lib/audit";
import { listExpenses, type ExpenseListFilter, type ExpenseListResult } from "@/lib/expenses";
import { centsToDecimalString, toCents, type Cents } from "@/lib/money";

export type ExpenseActionResult = {
  ok: boolean;
  message?: string;
  fieldErrors?: Partial<Record<keyof ExpenseCreateInput, string>>;
};

function fieldErrorsFromZod(
  issues: ZodIssue[],
): ExpenseActionResult["fieldErrors"] {
  const out: ExpenseActionResult["fieldErrors"] = {};
  for (const issue of issues) {
    const key = issue.path[0] as keyof ExpenseCreateInput | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

function readForm(formData: FormData) {
  return {
    expenseDate: String(formData.get("expenseDate") ?? "").trim(),
    category: String(formData.get("category") ?? "").trim(),
    expenseType: String(formData.get("expenseType") ?? "VARIABLE").trim(),
    description: String(formData.get("description") ?? "").trim(),
    amount: String(formData.get("amount") ?? "").trim(),
    paymentMethod: String(formData.get("paymentMethod") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  };
}

function readUpdateForm(formData: FormData) {
  return {
    expenseDate: String(formData.get("expenseDate") ?? "").trim(),
    category: String(formData.get("category") ?? "").trim(),
    expenseType: String(formData.get("expenseType") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    amount: String(formData.get("amount") ?? "").trim(),
    paymentMethod: String(formData.get("paymentMethod") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  };
}

export async function createExpenseAction(
  _prev: ExpenseActionResult | undefined,
  formData: FormData,
): Promise<ExpenseActionResult> {
  await requireRole(["ADMIN"]);

  const raw = readForm(formData);
  const parsed = ExpenseCreateSchema.safeParse({
    ...raw,
    expenseType: raw.expenseType || "VARIABLE",
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los datos del formulario.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  const user = await (await import("@/lib/permissions")).getCurrentUser();
  const prisma = getPrisma();
  const amountCents: Cents = toCents(parsed.data.amount);

  let expenseId: string;
  try {
    expenseId = await prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          expenseDate: new Date(parsed.data.expenseDate),
          category: parsed.data.category,
          expenseType: parsed.data.expenseType,
          status: "ACTIVE",
          description: parsed.data.description,
          amount: centsToDecimalString(amountCents),
          paymentMethod: parsed.data.paymentMethod ?? null,
          notes: parsed.data.notes ?? null,
          createdById: user?.id ?? null,
        },
        select: { id: true },
      });

      await auditInTx(tx, user?.id ?? null, {
        action: "EXPENSE_CREATED",
        entity: "Expense",
        entityId: created.id,
        metadata: {
          category: parsed.data.category,
          expenseType: parsed.data.expenseType,
          amount: centsToDecimalString(amountCents),
        },
      });

      return created.id;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000,
      timeout: 15000,
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      (err.code === "P2034" || err.message.includes("serialization"))
    ) {
      return { ok: false, message: "Conflicto al registrar el gasto. Intenta nuevamente." };
    }
    throw err;
  }

  revalidatePath("/gastos");
  redirect(`/gastos/${expenseId}`);
}

export async function updateExpenseAction(
  expenseId: string,
  _prev: ExpenseActionResult | undefined,
  formData: FormData,
): Promise<ExpenseActionResult> {
  await requireRole(["ADMIN"]);
  if (!expenseId) return { ok: false, message: "Falta el identificador del gasto." };

  const raw = readUpdateForm(formData);
  const parsed = ExpenseUpdateSchema.safeParse({
    ...raw,
    expenseType: raw.expenseType || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los datos del formulario.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  const user = await (await import("@/lib/permissions")).getCurrentUser();
  const prisma = getPrisma();

  const existing = await prisma.expense.findUnique({
    where: { id: expenseId },
    select: {
      id: true,
      expenseDate: true,
      category: true,
      expenseType: true,
      description: true,
      amount: true,
      paymentMethod: true,
      notes: true,
      status: true,
    },
  });
  if (!existing) return { ok: false, message: "El gasto ya no existe." };
  if (existing.status === "VOIDED") {
    return { ok: false, message: "No puedes editar un gasto anulado." };
  }

  const updateData: Record<string, unknown> = {};
  const changedFields: Record<string, { from: unknown; to: unknown }> = {};

  if (parsed.data.expenseDate) {
    const newDate = new Date(parsed.data.expenseDate);
    if (newDate.getTime() !== existing.expenseDate.getTime()) {
      changedFields.expenseDate = {
        from: existing.expenseDate.toISOString(),
        to: newDate.toISOString(),
      };
      updateData.expenseDate = newDate;
    }
  }
  if (parsed.data.category && parsed.data.category !== existing.category) {
    changedFields.category = { from: existing.category, to: parsed.data.category };
    updateData.category = parsed.data.category;
  }
  if (parsed.data.expenseType && parsed.data.expenseType !== existing.expenseType) {
    changedFields.expenseType = { from: existing.expenseType, to: parsed.data.expenseType };
    updateData.expenseType = parsed.data.expenseType;
  }
  if (parsed.data.description && parsed.data.description !== existing.description) {
    changedFields.description = { from: existing.description, to: parsed.data.description };
    updateData.description = parsed.data.description;
  }
  if (parsed.data.amount) {
    const newCents = toCents(parsed.data.amount);
    if (newCents !== toCents(existing.amount.toString())) {
      changedFields.amount = {
        from: existing.amount.toString(),
        to: centsToDecimalString(newCents),
      };
      updateData.amount = centsToDecimalString(newCents);
    }
  }
  if (parsed.data.paymentMethod !== undefined) {
    const next = parsed.data.paymentMethod ?? null;
    if (next !== existing.paymentMethod) {
      changedFields.paymentMethod = { from: existing.paymentMethod, to: next };
      updateData.paymentMethod = next;
    }
  }
  if (parsed.data.notes !== undefined) {
    const next = parsed.data.notes ?? null;
    if (next !== existing.notes) {
      changedFields.notes = { from: existing.notes, to: next };
      updateData.notes = next;
    }
  }

  if (Object.keys(updateData).length === 0) {
    redirect(`/gastos/${expenseId}`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.expense.update({
      where: { id: expenseId },
      data: updateData,
    });
    await auditInTx(tx, user?.id ?? null, {
      action: "EXPENSE_UPDATED",
      entity: "Expense",
      entityId: expenseId,
      metadata: { changes: changedFields },
    });
  });

  revalidatePath("/gastos");
  revalidatePath(`/gastos/${expenseId}`);
  redirect(`/gastos/${expenseId}`);
}

export async function voidExpenseAction(
  expenseId: string,
  _prev: ExpenseActionResult | undefined,
  formData: FormData,
): Promise<ExpenseActionResult> {
  await requireRole(["ADMIN"]);
  if (!expenseId) return { ok: false, message: "Falta el identificador del gasto." };

  const parsed = ExpenseVoidSchema.safeParse({
    voidReason: String(formData.get("voidReason") ?? "").trim(),
  });
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return {
      ok: false,
      message: firstIssue?.message ?? "Revisa el motivo de anulación.",
    };
  }

  const user = await (await import("@/lib/permissions")).getCurrentUser();
  const prisma = getPrisma();

  const existing = await prisma.expense.findUnique({
    where: { id: expenseId },
    select: { id: true, status: true },
  });
  if (!existing) return { ok: false, message: "El gasto ya no existe." };
  if (existing.status === "VOIDED") {
    return { ok: false, message: "El gasto ya está anulado." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.expense.update({
      where: { id: expenseId },
      data: {
        status: "VOIDED",
        voidedAt: new Date(),
        voidedById: user?.id ?? null,
        voidReason: parsed.data.voidReason,
      },
    });
    await auditInTx(tx, user?.id ?? null, {
      action: "EXPENSE_VOIDED",
      entity: "Expense",
      entityId: expenseId,
      metadata: { voidReason: parsed.data.voidReason },
    });
  });

  revalidatePath("/gastos");
  revalidatePath(`/gastos/${expenseId}`);
  return { ok: true, message: "Gasto anulado." };
}

export async function listExpensesAction(
  filter: ExpenseListFilter,
): Promise<ExpenseListResult> {
  await requireRole(["ADMIN"]);
  return listExpenses(filter);
}

export async function getExpenseDetailAction(expenseId: string) {
  await requireRole(["ADMIN"]);
  const prisma = getPrisma();
  return prisma.expense.findUnique({
    where: { id: expenseId },
    select: {
      id: true,
      expenseDate: true,
      category: true,
      expenseType: true,
      status: true,
      description: true,
      amount: true,
      paymentMethod: true,
      notes: true,
      voidedAt: true,
      voidReason: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { id: true, name: true, email: true } },
      voidedBy: { select: { id: true, name: true, email: true } },
    },
  });
}

export type ExpenseFinancialPeriodView = {
  year: number;
  month: number;
  revenue: string;
  productCost: string;
  grossProfit: string;
  paymentFee: string;
  packagingCost: string;
  netProfit: string;
  expenses: string;
  realNetProfit: string;
  marginPercent: number;
};
