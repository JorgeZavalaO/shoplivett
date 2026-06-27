"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ZodIssue } from "zod";

import { requireRole, getCurrentUser } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import {
  IncidentCreateSchema,
  IncidentResolveSchema,
  IncidentCancelSchema,
  type IncidentCreateInput,
} from "@/lib/validations";
import {
  createIncident,
  resolveIncident,
  cancelIncident,
  listIncidents,
  getIncidentDetail,
  type IncidentListFilter,
  type IncidentListResult,
  IncidentError,
} from "@/lib/incidents";

export type IncidentActionResult = {
  ok: boolean;
  message?: string;
  fieldErrors?: Partial<Record<keyof IncidentCreateInput, string>>;
};

function fieldErrorsFromZod(
  issues: ZodIssue[],
): IncidentActionResult["fieldErrors"] {
  const out: IncidentActionResult["fieldErrors"] = {};
  for (const issue of issues) {
    const key = issue.path[0] as keyof IncidentCreateInput | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

function readCreateForm(formData: FormData) {
  return {
    incidentDate: String(formData.get("incidentDate") ?? "").trim(),
    type: String(formData.get("type") ?? "").trim(),
    decision: String(formData.get("decision") ?? "NONE").trim(),
    orderId: String(formData.get("orderId") ?? "").trim(),
    orderItemId: String(formData.get("orderItemId") ?? "").trim(),
    variantId: String(formData.get("variantId") ?? "").trim(),
    customerId: String(formData.get("customerId") ?? "").trim(),
    quantity: formData.get("quantity"),
    description: String(formData.get("description") ?? "").trim(),
    recoveredAmount: String(formData.get("recoveredAmount") ?? "").trim(),
    lostAmount: String(formData.get("lostAmount") ?? "").trim(),
    restockQuantity: formData.get("restockQuantity"),
    notes: String(formData.get("notes") ?? "").trim(),
  };
}

function normalizeOptional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export async function createIncidentAction(
  _prev: IncidentActionResult | undefined,
  formData: FormData,
): Promise<IncidentActionResult> {
  await requireRole(["ADMIN"]);

  const raw = readCreateForm(formData);
  const parsed = IncidentCreateSchema.safeParse({
    ...raw,
    decision: raw.decision || "NONE",
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los datos del formulario.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  const user = await getCurrentUser();
  const actorId = user?.id ?? null;

  try {
    const result = await createIncident({
      incidentDate: parsed.data.incidentDate,
      type: parsed.data.type,
      decision: parsed.data.decision,
      orderId: normalizeOptional(raw.orderId),
      orderItemId: normalizeOptional(raw.orderItemId),
      variantId: normalizeOptional(raw.variantId),
      customerId: normalizeOptional(raw.customerId),
      quantity: parsed.data.quantity,
      description: parsed.data.description,
      recoveredAmount: normalizeOptional(raw.recoveredAmount),
      lostAmount: normalizeOptional(raw.lostAmount),
      restockQuantity: parsed.data.restockQuantity ?? null,
      notes: normalizeOptional(raw.notes),
      createdById: actorId,
    });

    // auditAfter: ya auditamos dentro de la transaccion; no bloqueamos
    // adicionalmente la respuesta.
    void result;

    revalidatePath("/incidencias");
    redirect(`/incidencias/${result.incidentId}`);
  } catch (err) {
    if (err instanceof IncidentError) {
      return { ok: false, message: err.message };
    }
    throw err;
  }
}

export async function resolveIncidentAction(
  incidentId: string,
  _prev: IncidentActionResult | undefined,
  formData: FormData,
): Promise<IncidentActionResult> {
  await requireRole(["ADMIN"]);
  if (!incidentId) return { ok: false, message: "Falta el identificador de la incidencia." };

  const parsed = IncidentResolveSchema.safeParse({
    resolutionNotes: String(formData.get("resolutionNotes") ?? "").trim(),
  });
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return {
      ok: false,
      message: firstIssue?.message ?? "Revisa los datos del formulario.",
    };
  }

  const user = await getCurrentUser();
  try {
    await resolveIncident({
      incidentId,
      actorId: user?.id ?? null,
      resolutionNotes: parsed.data.resolutionNotes ?? null,
    });
  } catch (err) {
    if (err instanceof IncidentError) {
      return { ok: false, message: err.message };
    }
    throw err;
  }

  revalidatePath("/incidencias");
  revalidatePath(`/incidencias/${incidentId}`);
  return { ok: true, message: "Incidencia resuelta." };
}

export async function cancelIncidentAction(
  incidentId: string,
  _prev: IncidentActionResult | undefined,
  formData: FormData,
): Promise<IncidentActionResult> {
  await requireRole(["ADMIN"]);
  if (!incidentId) return { ok: false, message: "Falta el identificador de la incidencia." };

  const parsed = IncidentCancelSchema.safeParse({
    cancelReason: String(formData.get("cancelReason") ?? "").trim(),
  });
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return {
      ok: false,
      message: firstIssue?.message ?? "Indica el motivo de la cancelacion.",
    };
  }

  const user = await getCurrentUser();
  try {
    await cancelIncident({
      incidentId,
      actorId: user?.id ?? null,
      reason: parsed.data.cancelReason,
    });
  } catch (err) {
    if (err instanceof IncidentError) {
      return { ok: false, message: err.message };
    }
    throw err;
  }

  revalidatePath("/incidencias");
  revalidatePath(`/incidencias/${incidentId}`);
  return { ok: true, message: "Incidencia cancelada." };
}

export async function listIncidentsAction(
  filter: IncidentListFilter,
): Promise<IncidentListResult> {
  await requireRole(["ADMIN"]);
  return listIncidents(filter);
}

export async function getIncidentDetailAction(incidentId: string) {
  await requireRole(["ADMIN"]);
  if (!incidentId) return null;
  return getIncidentDetail(incidentId);
}

export type IncidentSearchOrdersItem = {
  id: string;
  orderNumber: string;
  status: string;
  total: string;
  customer: { id: string; name: string; whatsapp: string };
};

export async function searchOrdersForIncidentAction(
  query: string,
): Promise<IncidentSearchOrdersItem[]> {
  await requireRole(["ADMIN"]);
  const prisma = getPrisma();
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { orderNumber: { contains: trimmed, mode: "insensitive" } },
        { customer: { name: { contains: trimmed, mode: "insensitive" } } },
        { customer: { whatsapp: { contains: trimmed.replace(/\D/g, "") } } },
      ],
    },
    take: 10,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      total: true,
      customer: { select: { id: true, name: true, whatsapp: true } },
    },
  });
  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    total: o.total.toString(),
    customer: o.customer,
  }));
}

export type IncidentSearchVariantsItem = {
  id: string;
  code: string;
  color: string | null;
  stock: number;
  soldStock: number;
  price: string;
  product: { id: string; name: string };
};

export async function searchVariantsForIncidentAction(
  query: string,
): Promise<IncidentSearchVariantsItem[]> {
  await requireRole(["ADMIN"]);
  const prisma = getPrisma();
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];
  const variants = await prisma.productVariant.findMany({
    where: {
      status: { in: ["ACTIVE", "HIDDEN"] },
      OR: [
        { code: { contains: trimmed, mode: "insensitive" } },
        { product: { name: { contains: trimmed, mode: "insensitive" } } },
        { color: { contains: trimmed, mode: "insensitive" } },
      ],
    },
    take: 10,
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      color: true,
      price: true,
      stock: true,
      soldStock: true,
      product: { select: { id: true, name: true } },
    },
  });
  return variants.map((v) => ({
    ...v,
    price: v.price.toString(),
  }));
}

export type IncidentSearchCustomersItem = {
  id: string;
  name: string;
  whatsapp: string;
};

export async function searchCustomersForIncidentAction(
  query: string,
): Promise<IncidentSearchCustomersItem[]> {
  await requireRole(["ADMIN"]);
  const prisma = getPrisma();
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];
  const customers = await prisma.customer.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: trimmed, mode: "insensitive" } },
        { whatsapp: { contains: trimmed.replace(/\D/g, "") } },
      ],
    },
    take: 10,
    orderBy: { name: "asc" },
    select: { id: true, name: true, whatsapp: true },
  });
  return customers;
}

export type IncidentOrderItemsForOrderResult = {
  orderId: string;
  items: Array<{
    id: string;
    quantity: number;
    lineTotal: string;
    variant: {
      id: string;
      code: string;
      color: string | null;
      product: { id: string; name: string };
    };
  }>;
};

export async function getOrderItemsForOrderAction(
  orderId: string,
): Promise<IncidentOrderItemsForOrderResult> {
  await requireRole(["ADMIN"]);
  if (!orderId) return { orderId, items: [] };
  const prisma = getPrisma();
  const items = await prisma.orderItem.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      quantity: true,
      lineTotal: true,
      variant: {
        select: {
          id: true,
          code: true,
          color: true,
          product: { select: { id: true, name: true } },
        },
      },
    },
  });
  return {
    orderId,
    items: items.map((i) => ({
      id: i.id,
      quantity: i.quantity,
      lineTotal: i.lineTotal.toString(),
      variant: i.variant,
    })),
  };
}
