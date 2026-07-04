"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma, type PaymentMethod, type PaymentStatus } from "@prisma/client";

import {
  requirePaymentValidator,
  requireRole,
  getCurrentUser,
} from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import {
  createPayment,
  setPaymentApplications,
  validatePayment,
  rejectPayment,
  PaymentError,
} from "@/lib/payments";
import { uploadImage, ImageUploadError, validateImageBatch } from "@/lib/blob";

const decimalString = z
  .string()
  .trim()
  .refine((s) => s === "" || /^\d+(\.\d{1,2})?$/.test(s), {
    message: "Debe tener hasta 2 decimales.",
  });

const ApplicationSchema = z.object({
  orderId: z.string().min(1, "Selecciona un pedido."),
  amount: decimalString,
});

const CreatePaymentSchema = z
  .object({
    customerId: z.string().min(1, "Selecciona una clienta."),
    method: z.enum(["YAPE", "PLIN", "CASH", "OTHER"]),
    amount: z
      .string()
      .trim()
      .min(1, "El monto es obligatorio.")
      .refine((s) => /^\d+(\.\d{1,2})?$/.test(s), {
        message: "El monto debe tener hasta 2 decimales.",
      }),
    operationNumber: z.string().trim().max(60).optional(),
    notes: z.string().trim().max(1000).optional(),
    applications: z
      .string()
      .transform((s) => {
        try {
          return JSON.parse(s) as { orderId: string; amount: string }[];
        } catch {
          return [];
        }
      })
      .pipe(z.array(ApplicationSchema)),
  })
  .superRefine((data, ctx) => {
    if (data.applications.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["applications"],
        message: "Aplica el pago a al menos un pedido.",
      });
    }
  });

export type PaymentActionResult = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  paymentId?: string;
};

function fieldErrorsFromZod(issues: z.ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

function readCreateForm(formData: FormData) {
  return {
    customerId: String(formData.get("customerId") ?? "").trim(),
    method: String(formData.get("method") ?? "YAPE").trim(),
    amount: String(formData.get("amount") ?? "").trim(),
    operationNumber: String(formData.get("operationNumber") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
    applications: String(formData.get("applications") ?? "[]").trim(),
  };
}

export async function createPaymentAction(
  _prev: PaymentActionResult | undefined,
  formData: FormData,
): Promise<PaymentActionResult> {
  await requireRole(["ADMIN", "SELLER"]);

  const parsed = CreatePaymentSchema.safeParse(readCreateForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los datos del formulario.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  const receiptFiles: File[] = [];
  for (const [key, value] of formData.entries()) {
    if (key === "receipts" && value instanceof File && value.size > 0) {
      receiptFiles.push(value);
    }
  }
  try {
    validateImageBatch(receiptFiles);
  } catch (error) {
    if (error instanceof ImageUploadError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }

  try {
    const result = await createPayment({
      customerId: parsed.data.customerId,
      method: parsed.data.method as PaymentMethod,
      amount: parsed.data.amount,
      operationNumber: parsed.data.operationNumber || null,
      notes: parsed.data.notes || null,
      applications: parsed.data.applications,
    });

    if (receiptFiles.length > 0) {
      const prisma = getPrisma();
      for (const file of receiptFiles) {
        const uploaded = await uploadImage(
          file,
          "payments/receipts",
          `manual-${result.paymentId}`,
          { access: "private" },
        );
        await prisma.paymentReceipt.create({
          data: {
            paymentId: result.paymentId,
            url: uploaded.url,
            pathname: uploaded.pathname,
          },
        });
      }
    }

    revalidatePath("/pagos");
    revalidatePath("/pedidos");
    redirect(`/pagos/${result.paymentId}`);
  } catch (error) {
    if (error instanceof PaymentError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof ImageUploadError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

const RejectSchema = z.object({
  paymentId: z.string().min(1),
  reason: z
    .string()
    .trim()
    .min(5, "Indica el motivo (mínimo 5 caracteres).")
    .max(500, "Máximo 500 caracteres."),
});

export async function rejectPaymentAction(
  _prev: PaymentActionResult | undefined,
  formData: FormData,
): Promise<PaymentActionResult> {
  await requirePaymentValidator();
  const user = await getCurrentUser();
  const parsed = RejectSchema.safeParse({
    paymentId: String(formData.get("paymentId") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los datos del formulario.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  try {
    const result = await rejectPayment({
      paymentId: parsed.data.paymentId,
      reason: parsed.data.reason,
      actorId: user?.id ?? null,
    });
    revalidatePath("/pagos");
    revalidatePath(`/pagos/${parsed.data.paymentId}`);
    revalidatePath("/pedidos");
    revalidatePath("/pedidos/vencidos");
    revalidatePath("/inventario");
    if (result.cancelledOrders.length > 0) {
      for (const cancelled of result.cancelledOrders) {
        revalidatePath(`/pedidos/${cancelled.orderId}`);
      }
    }
    if (result.cancelledOrders.length === 0) {
      return { ok: true, message: "Pago rechazado." };
    }
    const orderList = result.cancelledOrders
      .map((c) => c.orderNumber)
      .join(", ");
    const units = result.cancelledOrders.reduce(
      (acc, c) => acc + c.releasedUnits,
      0,
    );
    return {
      ok: true,
      message: `Pago rechazado. Se cancelaron ${result.cancelledOrders.length} reserva(s) (${orderList}) y se liberaron ${units} unidad(es) de stock.`,
    };
  } catch (error) {
    if (error instanceof PaymentError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

const ValidatePaymentInputSchema = z.object({
  paymentId: z.string().min(1, "Falta el identificador del pago."),
  excessTreatment: z.enum(["CREDIT", "REFUND", "REJECT"]).optional(),
  excessNotes: z.string().trim().max(500).optional(),
});

export type ValidatePaymentInput = z.infer<typeof ValidatePaymentInputSchema>;

export async function validatePaymentAction(
  input: ValidatePaymentInput,
): Promise<PaymentActionResult> {
  await requirePaymentValidator();
  const parsed = ValidatePaymentInputSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return {
      ok: false,
      message: firstIssue?.message ?? "Datos inválidos.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }
  const user = await getCurrentUser();
  try {
    const result = await validatePayment({
      paymentId: parsed.data.paymentId,
      excessTreatment: parsed.data.excessTreatment ?? "REJECT",
      excessNotes: parsed.data.excessNotes ?? null,
      validatedById: user?.id ?? null,
      actorId: user?.id ?? null,
    });
    revalidatePath("/pagos");
    revalidatePath(`/pagos/${parsed.data.paymentId}`);
    revalidatePath("/pedidos");
    revalidatePath("/lives");
    if (result.excessTreatment === "CREDIT") {
      revalidatePath("/clientes");
    }
    if (result.excessTreatment === "NONE") {
      return { ok: true, message: "Pago validado." };
    }
    const message =
      result.excessTreatment === "CREDIT"
        ? `Pago validado. Se generó un crédito de S/${(result.excessCents / 100).toFixed(2)}.`
        : `Pago validado. Se registró devolución de S/${(result.excessCents / 100).toFixed(2)}.`;
    return { ok: true, message };
  } catch (error) {
    if (error instanceof PaymentError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

const ApplicationsSchema = z.object({
  paymentId: z.string().min(1),
  applications: z
    .string()
    .transform((s) => {
      try {
        return JSON.parse(s) as { orderId: string; amount: string }[];
      } catch {
        return [];
      }
    })
    .pipe(z.array(ApplicationSchema)),
});

export async function updatePaymentApplicationsAction(
  _prev: PaymentActionResult | undefined,
  formData: FormData,
): Promise<PaymentActionResult> {
  await requireRole(["ADMIN", "SELLER"]);
  const parsed = ApplicationsSchema.safeParse({
    paymentId: String(formData.get("paymentId") ?? ""),
    applications: String(formData.get("applications") ?? "[]"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los datos del formulario.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }
  if (parsed.data.applications.length === 0) {
    return {
      ok: false,
      message: "Aplica el pago a al menos un pedido.",
      fieldErrors: { applications: "Aplica el pago a al menos un pedido." },
    };
  }
  try {
    const user = await getCurrentUser();
    await setPaymentApplications(parsed.data.paymentId, parsed.data.applications, {
      actorId: user?.id ?? null,
    });
    revalidatePath("/pagos");
    revalidatePath(`/pagos/${parsed.data.paymentId}`);
    return { ok: true, message: "Aplicación actualizada." };
  } catch (error) {
    if (error instanceof PaymentError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export type PaymentListItem = {
  id: string;
  status: PaymentStatus;
  method: PaymentMethod;
  amount: string;
  operationNumber: string | null;
  createdAt: Date;
  customer: { id: string; name: string; whatsapp: string };
  receiptCount: number;
  applicationCount: number;
};

export async function listPaymentsAction(args?: {
  query?: string;
  status?: PaymentStatus | "ALL";
  customerId?: string;
  page?: number;
  perPage?: number;
}): Promise<{
  items: PaymentListItem[];
  total: number;
  page: number;
  perPage: number;
  status: PaymentStatus | "ALL";
  query: string;
}> {
  await requireRole(["ADMIN", "SELLER"]);
  const safePage = Math.max(1, args?.page ?? 1);
  const safePerPage = Math.min(100, Math.max(1, args?.perPage ?? 20));
  const query = args?.query?.trim() ?? "";
  const status = args?.status ?? "ALL";
  const customerId = args?.customerId?.trim();

  const where: Prisma.PaymentWhereInput = {
    ...(status !== "ALL" ? { status } : {}),
    ...(customerId ? { customerId } : {}),
    ...(query
      ? {
          OR: [
            { operationNumber: { contains: query, mode: "insensitive" } },
            { customer: { name: { contains: query, mode: "insensitive" } } },
            { customer: { whatsapp: { contains: query.replace(/\D/g, "") } } },
          ],
        }
      : {}),
  };

  const prisma = getPrisma();
  const [total, items] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safePerPage,
      take: safePerPage,
      select: {
        id: true,
        status: true,
        method: true,
        amount: true,
        operationNumber: true,
        createdAt: true,
        customer: { select: { id: true, name: true, whatsapp: true } },
        _count: { select: { receipts: true, applications: true } },
      },
    }),
  ]);

  return {
    items: items.map((p) => ({
      id: p.id,
      status: p.status,
      method: p.method,
      amount: p.amount.toString(),
      operationNumber: p.operationNumber,
      createdAt: p.createdAt,
      customer: p.customer,
      receiptCount: p._count.receipts,
      applicationCount: p._count.applications,
    })),
    total,
    page: safePage,
    perPage: safePerPage,
    status,
    query,
  };
}

export async function getPaymentDetailAction(paymentId: string) {
  await requireRole(["ADMIN", "SELLER"]);
  if (!paymentId) return null;
  const prisma = getPrisma();
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      method: true,
      status: true,
      amount: true,
      operationNumber: true,
      notes: true,
      validatedAt: true,
      rejectedAt: true,
      rejectionReason: true,
      createdAt: true,
      updatedAt: true,
      customer: {
        select: {
          id: true,
          name: true,
          whatsapp: true,
          status: true,
        },
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          customerId: true,
        },
      },
      validatedBy: { select: { id: true, name: true } },
      rejectedBy: { select: { id: true, name: true } },
      receipts: {
        select: { id: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
      applications: {
        select: {
          id: true,
          amount: true,
          createdAt: true,
          order: {
            select: {
              id: true,
              orderNumber: true,
              total: true,
              validatedPaid: true,
              balance: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  return payment;
}

export async function searchOrdersForPaymentAction(
  query: string,
  customerId: string,
) {
  await requireRole(["ADMIN", "SELLER"]);
  if (!customerId) return [];
  const trimmed = query.trim();
  const prisma = getPrisma();
  const rows = await prisma.order.findMany({
    where: {
      customerId,
      status: { in: ["PAYMENT_VALIDATION_PENDING", "RESERVED", "PARTIALLY_PAID"] },
      ...(trimmed
        ? {
            OR: [
              { orderNumber: { contains: trimmed, mode: "insensitive" } },
            ],
          }
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

export async function searchCustomersForPaymentAction(query: string) {
  await requireRole(["ADMIN", "SELLER"]);
  if (!query.trim()) return [];
  const prisma = getPrisma();
  return prisma.customer.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { whatsapp: { contains: query.replace(/\D/g, "") } },
      ],
    },
    take: 20,
    orderBy: { name: "asc" },
    select: { id: true, name: true, whatsapp: true },
  });
}

export type CustomerPaymentItem = {
  id: string;
  amount: string;
  method: PaymentMethod;
  status: string;
  operationNumber: string | null;
  createdAt: Date;
  validatedAt: Date | null;
  orderNumbers: string[];
};

export async function listCustomerPaymentsAction(
  customerId: string,
  args?: { page?: number; perPage?: number },
) {
  await requireRole(["ADMIN", "SELLER"]);
  if (!customerId) return { items: [], total: 0, page: 1, perPage: 20 };
  const safePage = Math.max(1, args?.page ?? 1);
  const safePerPage = Math.min(50, Math.max(1, args?.perPage ?? 10));
  const prisma = getPrisma();
  const where = { applications: { some: { order: { customerId } } } };
  const [total, items] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safePerPage,
      take: safePerPage,
      select: {
        id: true,
        amount: true,
        method: true,
        status: true,
        operationNumber: true,
        createdAt: true,
        validatedAt: true,
        applications: {
          select: { order: { select: { orderNumber: true } } },
          take: 5,
        },
      },
    }),
  ]);
  return {
    items: items.map((p) => ({
      id: p.id,
      amount: p.amount.toString(),
      method: p.method,
      status: p.status,
      operationNumber: p.operationNumber,
      createdAt: p.createdAt,
      validatedAt: p.validatedAt,
      orderNumbers: p.applications.map((a) => a.order.orderNumber),
    })),
    total,
    page: safePage,
    perPage: safePerPage,
    remainingPages: Math.max(0, Math.ceil(total / safePerPage) - safePage),
  };
}
