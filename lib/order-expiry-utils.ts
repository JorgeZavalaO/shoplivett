// Funciones puras de expiración de pedidos, sin dependencias de Prisma.
// Extraídas de lib/orders.ts para que puedan ser importadas desde
// componentes cliente sin arrastrar el bundle de Prisma/pg.
//
// lib/orders.ts re-exporta estas funciones para backward compatibility.

/**
 * Estados de pedido que aún tienen una reserva activa y por tanto pueden
 * evaluarse para "por vencer" o "vencida".
 */
const ACTIVE_RESERVATION_STATUSES = new Set([
  "PAYMENT_VALIDATION_PENDING",
  "RESERVED",
]);

/** Estructura derivada de la fecha de expiración de un pedido. */
export type OrderExpiryState = {
  isOverdue: boolean;
  isNearExpiry: boolean;
  hoursUntilExpiry: number;
};

/**
 * Calcula los flags derivados (`isOverdue`, `isNearExpiry`) a partir de
 * `expiresAt`. Pensado para vista de listas, dashboards y badges.
 *
 * - `isOverdue`: ya pasó la fecha y el pedido sigue con reserva activa.
 * - `isNearExpiry`: faltan menos de `nearExpiryHours` horas.
 */
export function deriveOrderExpiryState(
  expiresAt: Date | string,
  options: { now?: Date; nearExpiryHours?: number; status?: string } = {},
): OrderExpiryState {
  const now = options.now ?? new Date();
  const nearExpiryHours = options.nearExpiryHours ?? 48;
  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();
  const hoursUntilExpiry = diffMs / (60 * 60 * 1000);
  const status = options.status;
  const hasActiveReservation =
    !status || ACTIVE_RESERVATION_STATUSES.has(status);
  return {
    isOverdue: hasActiveReservation && diffMs < 0,
    isNearExpiry:
      hasActiveReservation && diffMs >= 0 && hoursUntilExpiry <= nearExpiryHours,
    hoursUntilExpiry,
  };
}

/** Etiqueta humana del estado derivado de vencimiento. */
export function formatOrderExpiryState(state: OrderExpiryState): string {
  if (state.isOverdue) return "Vencida";
  if (state.isNearExpiry) {
    const hours = Math.max(1, Math.round(state.hoursUntilExpiry));
    return `Vence en ${hours} h`;
  }
  const days = Math.round(state.hoursUntilExpiry / 24);
  if (days <= 1) return "Vence pronto";
  return `Vence en ${days} días`;
}
