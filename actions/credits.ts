"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole, getCurrentUser } from "@/lib/permissions";
import {
  applyCreditToOrder,
  createManualCredit,
  getCustomerAvailableCredit,
  listCustomerCredits,
  refundCredit,
  CreditError,
} from "@/lib/credits";

export type CreditActionResult = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  creditId?: string;
};

function fieldErrorsFromZod(issues: z.ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

const ManualCreditSchema = z.object({
  customerId: z.string().min(1, "Selecciona una clienta."),
  amount: z
    .string()
    .trim()
    .min(1, "El monto es obligatorio.")
    .refine((s) => /^\d+(\.\d{1,2})?$/.test(s), {
      message: "El monto debe tener hasta 2 decimales.",
    }),
  notes: z.string().trim().max(500).optional(),
});

export async function createManualCreditAction(
  _prev: CreditActionResult | undefined,
  formData: FormData,
): Promise<CreditActionResult> {
  await requireRole(["ADMIN", "SELLER"]);
  const parsed = ManualCreditSchema.safeParse({
    customerId: String(formData.get("customerId") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los datos del formulario.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }
  const user = await getCurrentUser();
  try {
    const result = await createManualCredit({
      customerId: parsed.data.customerId,
      amount: parsed.data.amount,
      notes: parsed.data.notes || null,
      createdById: user?.id ?? null,
    });
    revalidatePath(`/clientes/${parsed.data.customerId}`);
    revalidatePath("/pagos");
    return { ok: true, message: "Crédito registrado.", creditId: result.creditId };
  } catch (error) {
    if (error instanceof CreditError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

const ApplyCreditSchema = z.object({
  creditId: z.string().min(1),
  orderId: z.string().min(1, "Selecciona un pedido."),
  amount: z
    .string()
    .trim()
    .min(1, "El monto es obligatorio.")
    .refine((s) => /^\d+(\.\d{1,2})?$/.test(s), {
      message: "El monto debe tener hasta 2 decimales.",
    }),
});

export async function applyCreditToOrderAction(
  _prev: CreditActionResult | undefined,
  formData: FormData,
): Promise<CreditActionResult> {
  await requireRole(["ADMIN", "SELLER"]);
  const parsed = ApplyCreditSchema.safeParse({
    creditId: String(formData.get("creditId") ?? ""),
    orderId: String(formData.get("orderId") ?? ""),
    amount: String(formData.get("amount") ?? ""),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los datos del formulario.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }
  const user = await getCurrentUser();
  try {
    const result = await applyCreditToOrder({
      creditId: parsed.data.creditId,
      orderId: parsed.data.orderId,
      amount: parsed.data.amount,
      createdById: user?.id ?? null,
    });
    revalidatePath(`/pagos`);
    revalidatePath(`/pedidos/${parsed.data.orderId}`);
    revalidatePath("/pedidos");
    return {
      ok: true,
      message: `Crédito aplicado. Saldo restante del pedido: S/${result.remainingOrderBalance}.`,
    };
  } catch (error) {
    if (error instanceof CreditError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

const RefundSchema = z.object({
  creditId: z.string().min(1),
  reason: z
    .string()
    .trim()
    .min(5, "Indica el motivo (mínimo 5 caracteres).")
    .max(500, "Máximo 500 caracteres."),
});

export async function refundCreditAction(
  _prev: CreditActionResult | undefined,
  formData: FormData,
): Promise<CreditActionResult> {
  await requireRole(["ADMIN", "SELLER"]);
  const parsed = RefundSchema.safeParse({
    creditId: String(formData.get("creditId") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los datos del formulario.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }
  const user = await getCurrentUser();
  try {
    const refunded = await refundCredit({
      creditId: parsed.data.creditId,
      reason: parsed.data.reason,
      refundedById: user?.id ?? null,
    });
    revalidatePath("/pagos");
    revalidatePath("/clientes");
    revalidatePath(`/clientes/${refunded.customerId}`);
    return { ok: true, message: "Devolución registrada.", creditId: refunded.creditId };
  } catch (error) {
    if (error instanceof CreditError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function getCustomerCreditsAction(customerId: string) {
  await requireRole(["ADMIN", "SELLER", "DISPATCH"]);
  if (!customerId) return [];
  return listCustomerCredits(customerId);
}

export async function getCustomerAvailableCreditAction(
  customerId: string,
): Promise<{ available: string }> {
  await requireRole(["ADMIN", "SELLER", "DISPATCH"]);
  if (!customerId) return { available: "0.00" };
  const available = await getCustomerAvailableCredit(customerId);
  return { available };
}

export async function getCreditDetailAction(creditId: string) {
  await requireRole(["ADMIN", "SELLER", "DISPATCH"]);
  if (!creditId) return null;
  const { getPrisma } = await import("@/lib/prisma");
  const credit = await getPrisma().customerCredit.findUnique({
    where: { id: creditId },
    include: {
      customer: { select: { id: true, name: true, whatsapp: true } },
      applications: {
        include: {
          order: { select: { id: true, orderNumber: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      payment: {
        select: { id: true, method: true, amount: true, createdAt: true },
      },
      createdBy: { select: { id: true, name: true } },
      refundedBy: { select: { id: true, name: true } },
    },
  });
  return credit;
}

export async function searchOrdersForCreditAction(query: string, customerId: string) {
  await requireRole(["ADMIN", "SELLER", "DISPATCH"]);
  if (!customerId) return [];
  const trimmed = query.trim();
  const { getPrisma } = await import("@/lib/prisma");
  const rows = await getPrisma().order.findMany({
    where: {
      customerId,
      status: { in: ["PAYMENT_VALIDATION_PENDING", "RESERVED", "PARTIALLY_PAID"] },
      ...(trimmed
        ? { OR: [{ orderNumber: { contains: trimmed, mode: "insensitive" } }] }
        : {}),
    },
    take: 20,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderNumber: true,
      total: true,
      balance: true,
      status: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    orderNumber: r.orderNumber,
    total: r.total.toString(),
    balance: r.balance.toString(),
    status: r.status,
  }));
}
