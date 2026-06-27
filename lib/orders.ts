// Helpers para pedidos: generación de número, cálculo de totales y expiración.

import type { PrismaTransactionClient } from "@/lib/prisma";
import { getPrisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { toCents, centsToDecimalString, type Cents } from "@/lib/money";

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
 * Todos los cálculos se realizan en centavos enteros para evitar imprecisiones
 * de punto flotante, y se devuelven como strings con exactamente 2 decimales.
 */
export function calculateOrderTotals(
  items: LineItem[],
  discount: string,
  shippingAmount: string,
): OrderTotals {
  let subtotalCents: Cents = 0;
  for (const item of items) {
    const lineCents = toCents(item.unitPrice, { allowNegative: true }) * item.quantity;
    subtotalCents += lineCents;
  }
  const discountCents = toCents(discount || "0", { allowNegative: true });
  const shippingCents = toCents(shippingAmount || "0", { allowNegative: true });
  const totalCents = Math.max(0, subtotalCents - discountCents + shippingCents);
  return {
    subtotal: centsToDecimalString(subtotalCents),
    total: centsToDecimalString(totalCents),
  };
}

/** Calcula el saldo del pedido: total - monto validado. */
export function calculateOrderBalance(total: string, validatedPaid: string): string {
  const totalCents = toCents(total, { allowNegative: true });
  const paidCents = toCents(validatedPaid, { allowNegative: true });
  return centsToDecimalString(Math.max(0, totalCents - paidCents));
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

// Re-export de funciones puras de expiración desde lib/order-expiry-utils.ts
// para backward compatibility. Los clientes nuevos deben importar
// directamente desde "@/lib/order-expiry-utils".
export {
  deriveOrderExpiryState,
  formatOrderExpiryState,
  type OrderExpiryState,
} from "./order-expiry-utils";
