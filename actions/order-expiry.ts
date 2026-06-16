"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole, getCurrentUser } from "@/lib/permissions";
import {
  expireReservation,
  listExpiredReservations,
  listReservationsNearExpiry,
  OrderExpiryError,
} from "@/lib/order-expiry";
import { auditAfter } from "@/lib/audit";

export type ExpireOrderResult = {
  ok: boolean;
  message?: string;
  releasedUnits?: number;
};

const ExpireSchema = z.object({
  orderId: z.string().min(1, "Falta el identificador del pedido."),
  reason: z.string().trim().max(500).optional(),
});

export async function listExpiredReservationsAction(args?: {
  query?: string;
  page?: number;
  perPage?: number;
}) {
  await requireRole(["ADMIN", "SELLER"]);
  return listExpiredReservations(args);
}

export async function listReservationsNearExpiryAction(days = 2) {
  await requireRole(["ADMIN", "SELLER"]);
  return listReservationsNearExpiry({ days });
}

export async function expireReservationAction(
  _prev: ExpireOrderResult | undefined,
  formData: FormData,
): Promise<ExpireOrderResult> {
  await requireRole(["ADMIN", "SELLER"]);
  const parsed = ExpireSchema.safeParse({
    orderId: String(formData.get("orderId") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, message: "Falta el identificador del pedido." };
  }
  const user = await getCurrentUser();
  try {
    const result = await expireReservation({
      orderId: parsed.data.orderId,
      expiredById: user?.id ?? null,
      reason: parsed.data.reason || null,
    });
    auditAfter(user?.id ?? null, {
      action: "RESERVATION_EXPIRED",
      entity: "Order",
      entityId: parsed.data.orderId,
      metadata: {
        releasedUnits: result.releasedUnits,
        reason: parsed.data.reason ?? null,
      },
    });
    revalidatePath("/pedidos/vencidos");
    revalidatePath(`/pedidos/${parsed.data.orderId}`);
    revalidatePath("/pedidos");
    revalidatePath("/inventario");
    return {
      ok: true,
      message: `Reserva vencida cancelada. Se liberaron ${result.releasedUnits} unidad(es) de stock.`,
      releasedUnits: result.releasedUnits,
    };
  } catch (error) {
    if (error instanceof OrderExpiryError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}
