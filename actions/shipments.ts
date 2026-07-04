"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ShipmentStatus } from "@prisma/client";

import { getCurrentUser, requireRole } from "@/lib/permissions";
import {
  cancelShipment,
  changeShipmentStatus,
  createShipment,
  getEligibleOrdersForShipment,
  getOrderShipmentLink,
  getShipmentDetail,
  listCustomerShipments,
  listShipments,
  ShipmentError,
  updateShipment,
} from "@/lib/shipments";

const shippingMethodEnum = z.enum([
  "DELIVERY_PROPIO",
  "OLVA",
  "SHALOM",
  "MOTORIZADO",
  "RECOJO",
]);

const shipmentStatusEnum = z.enum([
  "PENDING",
  "PREPARING",
  "READY",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
]);

function fieldErrorsFromZod(issues: z.ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export type ShipmentActionResult = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  shipmentId?: string;
};

const CreateSchema = z.object({
  customerId: z.string().min(1, "Selecciona una clienta."),
  shippingMethod: shippingMethodEnum,
  shippingCost: z
    .string()
    .trim()
    .refine((s) => s === "" || /^\d+(\.\d{1,2})?$/.test(s), {
      message: "Costo inválido.",
    })
    .transform((s) => (s === "" ? "0" : s)),
  forceFreeShipping: z
    .union([z.boolean(), z.literal("on"), z.literal("true"), z.literal("false")])
    .transform((v) => v === true || v === "on" || v === "true")
    .optional(),
  orderIds: z
    .string()
    .transform((s) => {
      try {
        return JSON.parse(s) as string[];
      } catch {
        return [];
      }
    })
    .pipe(z.array(z.string().min(1)).min(1, "Selecciona al menos un pedido.")),
  agencyName: z.string().trim().max(120).optional(),
  trackingCode: z.string().trim().max(120).optional(),
  addressSnapshot: z.string().trim().max(500).optional(),
  districtSnapshot: z.string().trim().max(120).optional(),
  referenceSnapshot: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export async function createShipmentAction(
  _prev: ShipmentActionResult | undefined,
  formData: FormData,
): Promise<ShipmentActionResult> {
  await requireRole(["ADMIN", "DISPATCH"]);
  const parsed = CreateSchema.safeParse({
    customerId: String(formData.get("customerId") ?? ""),
    shippingMethod: String(formData.get("shippingMethod") ?? "DELIVERY_PROPIO"),
    shippingCost: String(formData.get("shippingCost") ?? "0"),
    forceFreeShipping: formData.get("forceFreeShipping") ?? "false",
    orderIds: String(formData.get("orderIds") ?? "[]"),
    agencyName: String(formData.get("agencyName") ?? ""),
    trackingCode: String(formData.get("trackingCode") ?? ""),
    addressSnapshot: String(formData.get("addressSnapshot") ?? ""),
    districtSnapshot: String(formData.get("districtSnapshot") ?? ""),
    referenceSnapshot: String(formData.get("referenceSnapshot") ?? ""),
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
    const result = await createShipment({
      customerId: parsed.data.customerId,
      shippingMethod: parsed.data.shippingMethod,
      orderIds: parsed.data.orderIds,
      shippingCost: parsed.data.shippingCost,
      forceFreeShipping: parsed.data.forceFreeShipping ?? false,
      agencyName: parsed.data.agencyName || null,
      trackingCode: parsed.data.trackingCode || null,
      addressSnapshot: parsed.data.addressSnapshot || null,
      districtSnapshot: parsed.data.districtSnapshot || null,
      referenceSnapshot: parsed.data.referenceSnapshot || null,
      notes: parsed.data.notes || null,
      createdById: user?.id ?? null,
      actorId: user?.id ?? null,
    });
    revalidatePath("/envios");
    revalidatePath(`/envios/${result.shipmentId}`);
    revalidatePath("/pedidos");
    revalidatePath(`/clientes/${parsed.data.customerId}`);
    return { ok: true, message: "Envío creado.", shipmentId: result.shipmentId };
  } catch (error) {
    if (error instanceof ShipmentError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

const UpdateSchema = z.object({
  shipmentId: z.string().min(1),
  shippingMethod: shippingMethodEnum.optional(),
  shippingCost: z
    .string()
    .trim()
    .refine((s) => s === "" || /^\d+(\.\d{1,2})?$/.test(s), {
      message: "Costo inválido.",
    })
    .transform((s) => (s === "" ? undefined : s))
    .optional(),
  isFreeShipping: z
    .union([z.boolean(), z.literal("on"), z.literal("true"), z.literal("false")])
    .transform((v) => v === true || v === "on" || v === "true")
    .optional(),
  agencyName: z.string().trim().max(120).optional(),
  trackingCode: z.string().trim().max(120).optional(),
  addressSnapshot: z.string().trim().max(500).optional(),
  districtSnapshot: z.string().trim().max(120).optional(),
  referenceSnapshot: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export async function updateShipmentAction(
  _prev: ShipmentActionResult | undefined,
  formData: FormData,
): Promise<ShipmentActionResult> {
  await requireRole(["ADMIN", "DISPATCH"]);
  const parsed = UpdateSchema.safeParse({
    shipmentId: String(formData.get("shipmentId") ?? ""),
    shippingMethod: formData.get("shippingMethod") || undefined,
    shippingCost: String(formData.get("shippingCost") ?? ""),
    isFreeShipping: formData.get("isFreeShipping") ?? "false",
    agencyName: String(formData.get("agencyName") ?? ""),
    trackingCode: String(formData.get("trackingCode") ?? ""),
    addressSnapshot: String(formData.get("addressSnapshot") ?? ""),
    districtSnapshot: String(formData.get("districtSnapshot") ?? ""),
    referenceSnapshot: String(formData.get("referenceSnapshot") ?? ""),
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
    await updateShipment({
      shipmentId: parsed.data.shipmentId,
      shippingMethod: parsed.data.shippingMethod,
      shippingCost: parsed.data.shippingCost,
      isFreeShipping: parsed.data.isFreeShipping,
      agencyName: parsed.data.agencyName,
      trackingCode: parsed.data.trackingCode,
      addressSnapshot: parsed.data.addressSnapshot,
      districtSnapshot: parsed.data.districtSnapshot,
      referenceSnapshot: parsed.data.referenceSnapshot,
      notes: parsed.data.notes,
      updatedById: user?.id ?? null,
      actorId: user?.id ?? null,
    });
    revalidatePath("/envios");
    revalidatePath(`/envios/${parsed.data.shipmentId}`);
    return { ok: true, message: "Envío actualizado." };
  } catch (error) {
    if (error instanceof ShipmentError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

const StatusSchema = z.object({
  shipmentId: z.string().min(1),
  to: shipmentStatusEnum,
});

export async function changeShipmentStatusAction(
  _prev: ShipmentActionResult | undefined,
  formData: FormData,
): Promise<ShipmentActionResult> {
  await requireRole(["ADMIN", "DISPATCH"]);
  const parsed = StatusSchema.safeParse({
    shipmentId: String(formData.get("shipmentId") ?? ""),
    to: String(formData.get("to") ?? ""),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Estado inválido.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }
  try {
    const user = await getCurrentUser();
    await changeShipmentStatus({
      shipmentId: parsed.data.shipmentId,
      to: parsed.data.to as ShipmentStatus,
      actorId: user?.id ?? null,
    });
    revalidatePath("/envios");
    revalidatePath(`/envios/${parsed.data.shipmentId}`);
    revalidatePath("/pedidos");
    return { ok: true, message: "Estado actualizado." };
  } catch (error) {
    if (error instanceof ShipmentError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

const CancelSchema = z.object({
  shipmentId: z.string().min(1),
  reason: z.string().trim().max(500).optional(),
});

export async function cancelShipmentAction(
  _prev: ShipmentActionResult | undefined,
  formData: FormData,
): Promise<ShipmentActionResult> {
  await requireRole(["ADMIN", "DISPATCH"]);
  const parsed = CancelSchema.safeParse({
    shipmentId: String(formData.get("shipmentId") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Falta el identificador del envío.",
    };
  }
  try {
    const user = await getCurrentUser();
    await cancelShipment({
      shipmentId: parsed.data.shipmentId,
      reason: parsed.data.reason || null,
      actorId: user?.id ?? null,
    });
    revalidatePath("/envios");
    revalidatePath(`/envios/${parsed.data.shipmentId}`);
    revalidatePath("/pedidos");
    return { ok: true, message: "Envío cancelado." };
  } catch (error) {
    if (error instanceof ShipmentError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function listShipmentsAction(args?: {
  query?: string;
  status?: ShipmentStatus | "ALL";
  customerId?: string;
  page?: number;
  perPage?: number;
}) {
  await requireRole(["ADMIN", "DISPATCH"]);
  return listShipments(args);
}

export async function getShipmentDetailAction(shipmentId: string) {
  await requireRole(["ADMIN", "DISPATCH"]);
  if (!shipmentId) return null;
  return getShipmentDetail(shipmentId);
}

export async function searchCustomersForShipmentAction(query: string) {
  await requireRole(["ADMIN", "DISPATCH"]);
  if (!query.trim()) return [];
  const { getPrisma } = await import("@/lib/prisma");
  return getPrisma().customer.findMany({
    where: {
      isActive: true,
      orders: {
        some: {
          status: "PAID",
          shipmentOrders: { none: { shipment: { status: { not: "CANCELLED" } } } },
        },
      },
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

export async function getEligibleOrdersForShipmentAction(
  customerId: string,
  query?: string,
) {
  await requireRole(["ADMIN", "DISPATCH"]);
  return getEligibleOrdersForShipment(customerId, query);
}

export async function getShipmentDraftDefaultsAction(args: {
  customerId?: string;
  orderId?: string;
}) {
  await requireRole(["ADMIN", "DISPATCH"]);
  const customerId = args.customerId?.trim();
  const orderId = args.orderId?.trim();
  if (!customerId && !orderId) return { customer: null, order: null };

  const { getPrisma } = await import("@/lib/prisma");
  const prisma = getPrisma();

  if (orderId) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        total: true,
        status: true,
        customer: { select: { id: true, name: true, whatsapp: true } },
        shipmentOrders: {
          where: { shipment: { status: { not: "CANCELLED" } } },
          select: { shipment: { select: { status: true } } },
          take: 1,
        },
      },
    });
    if (
      !order ||
      order.status !== "PAID" ||
      order.shipmentOrders.length > 0
    ) {
      return { customer: null, order: null };
    }
    return {
      customer: order.customer,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        total: order.total.toString(),
      },
    };
  }

  if (!customerId) return { customer: null, order: null };
  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      isActive: true,
      orders: {
        some: {
          status: "PAID",
          shipmentOrders: { none: { shipment: { status: { not: "CANCELLED" } } } },
        },
      },
    },
    select: { id: true, name: true, whatsapp: true },
  });
  return { customer, order: null };
}

export async function getOrderShipmentLinkAction(orderId: string) {
  await requireRole(["ADMIN", "SELLER"]);
  if (!orderId) return null;
  return getOrderShipmentLink(orderId);
}

export async function listCustomerShipmentsAction(customerId: string) {
  await requireRole(["ADMIN", "SELLER"]);
  if (!customerId) return [];
  return listCustomerShipments(customerId);
}
