"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole, getCurrentUser } from "@/lib/permissions";
import {
  cancelUnpaidOrder,
  OrderExpiryError,
} from "@/lib/order-expiry";

export type CancelUnpaidOrderResult = {
  ok: boolean;
  message?: string;
  releasedUnits?: number;
};

const CancelSchema = z.object({
  orderId: z.string().min(1, "Falta el identificador del pedido."),
  reason: z.string().trim().max(500).optional(),
});

export async function cancelUnpaidOrderAction(
  _prev: CancelUnpaidOrderResult | undefined,
  formData: FormData,
): Promise<CancelUnpaidOrderResult> {
  await requireRole(["ADMIN", "SELLER"]);
  const parsed = CancelSchema.safeParse({
    orderId: String(formData.get("orderId") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, message: "Falta el identificador del pedido." };
  }
  const user = await getCurrentUser();
  try {
    const result = await cancelUnpaidOrder({
      orderId: parsed.data.orderId,
      actorId: user?.id ?? null,
      reason: parsed.data.reason || null,
    });
    revalidatePath("/pedidos");
    revalidatePath("/pedidos/vencidos");
    revalidatePath(`/pedidos/${parsed.data.orderId}`);
    revalidatePath("/inventario");
    return {
      ok: true,
      message: `Pedido cancelado. Se liberaron ${result.releasedUnits} unidad(es) de stock.`,
      releasedUnits: result.releasedUnits,
    };
  } catch (error) {
    if (error instanceof OrderExpiryError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}
