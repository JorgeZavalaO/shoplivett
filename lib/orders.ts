// Helpers para pedidos: generación de número, cálculo de totales y expiración.

import type { PrismaTransactionClient } from "@/lib/prisma";
import { getPrisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

/**
 * Genera un número de pedido único por día: ORD-YYYYMMDD-NNNN.
 * El contador se reinicia cada día.
 */
export async function generateOrderNumber(
  tx?: PrismaTransactionClient,
): Promise<string> {
  const prisma = tx ?? getPrisma();
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const datePrefix = `${y}${m}${d}`;
  const pattern = `ORD-${datePrefix}-`;

  const last = await prisma.order.findFirst({
    where: { orderNumber: { startsWith: pattern } },
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true },
  });

  let suffix = 1;
  if (last) {
    const tail = last.orderNumber.slice(pattern.length);
    const n = Number.parseInt(tail, 10);
    if (Number.isFinite(n)) suffix = n + 1;
  }

  return `${pattern}${String(suffix).padStart(4, "0")}`;
}

export type LineItem = {
  variantId: string;
  quantity: number;
  unitPrice: string;
};

export type OrderTotals = {
  subtotal: string;
  total: string;
};

/**
 * Calcula subtotal y total a partir de items, descuento y costo de envío.
 * Todos los valores se manejan como strings decimales para preservar precisión.
 */
export function calculateOrderTotals(
  items: LineItem[],
  discount: string,
  shippingAmount: string,
): OrderTotals {
  const subtotal = items.reduce((sum, item) => {
    const line = Number(item.unitPrice) * item.quantity;
    return sum + line;
  }, 0);
  const discNum = Number(discount) || 0;
  const shipNum = Number(shippingAmount) || 0;
  const total = Math.max(0, subtotal - discNum + shipNum);
  return {
    subtotal: subtotal.toFixed(2),
    total: total.toFixed(2),
  };
}

/** Calcula el saldo del pedido: total - monto validado. */
export function calculateOrderBalance(total: string, validatedPaid: string): string {
  const totalNum = Number(total);
  const paidNum = Number(validatedPaid);
  return Math.max(0, totalNum - paidNum).toFixed(2);
}

/** Calcula la fecha de expiración: createdAt + reservationDays (de BusinessSettings). */
export async function calculateOrderExpiry(
  createdAt: Date,
  reservationDays?: number,
): Promise<Date> {
  const days = reservationDays ?? (await getSettings()).reservationDays;
  const expiry = new Date(createdAt);
  expiry.setDate(expiry.getDate() + days);
  return expiry;
}
