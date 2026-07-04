// Utilidades y plantillas para mensajes de WhatsApp (Sprint 12).
// Genera texto listo para copiar o abrir en WhatsApp Web. No envía
// mensajes automáticamente: el operador decide.

import { normalizeWhatsApp } from "@/lib/phone";
import { PAYMENT_METHOD_LABELS, SHIPPING_METHOD_LABELS } from "@/lib/settings-defaults";
import type { PaymentMethod, ShippingMethod } from "@prisma/client";

const STORE_NAME = "Shoplivett";

const DATE_FORMATTER = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const LONG_DATE_FORMATTER = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

function clean(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function safe(value: string | number | null | undefined, fallback = "—"): string {
  const c = clean(value);
  return c.length > 0 ? c : fallback;
}

function money(value: string | number | null | undefined): string {
  const c = clean(value);
  if (!c) return "—";
  return `S/ ${c}`;
}

function date(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return DATE_FORMATTER.format(d);
}

function longDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return LONG_DATE_FORMATTER.format(d);
}

export function buildWhatsappLink(phone: string | null | undefined, text: string): string | null {
  const normalized = normalizeWhatsApp(phone);
  if (!normalized) return null;
  const digits = normalized.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export type CustomerContext = {
  name: string;
  whatsapp: string;
};

export type OrderContext = {
  orderNumber: string;
  total: string;
  validatedPaid?: string | null;
  balance: string;
  expiresAt: Date | string;
  status?: string;
};

export type PaymentContext = {
  amount: string;
  method: PaymentMethod;
  operationNumber?: string | null;
};

export type ShipmentContext = {
  shippingMethod: ShippingMethod;
  agencyName?: string | null;
  trackingCode?: string | null;
  expectedDelivery?: Date | string | null;
};

export type CreditContext = {
  totalAmount: string;
  availableAmount: string;
};

export type OrderTemplateKey =
  | "SEPARATION_PENDING_VALIDATION"
  | "SEPARATION_CONFIRMED"
  | "BALANCE_REMINDER"
  | "RESERVATION_NEAR_EXPIRY"
  | "RESERVATION_EXPIRED"
  | "PAYMENT_VALIDATED"
  | "SHIPMENT_SENT"
  | "CREDIT_AVAILABLE";

export type BuildTemplateInput =
  | {
      key: "SEPARATION_PENDING_VALIDATION";
      customer: CustomerContext;
      order: OrderContext;
    }
  | {
      key: "SEPARATION_CONFIRMED";
      customer: CustomerContext;
      order: OrderContext;
      payment: PaymentContext;
    }
  | {
      key: "BALANCE_REMINDER";
      customer: CustomerContext;
      order: OrderContext;
    }
  | {
      key: "RESERVATION_NEAR_EXPIRY";
      customer: CustomerContext;
      order: OrderContext;
    }
  | {
      key: "RESERVATION_EXPIRED";
      customer: CustomerContext;
      order: OrderContext;
    }
  | {
      key: "PAYMENT_VALIDATED";
      customer: CustomerContext;
      order: OrderContext;
      payment: PaymentContext;
    }
  | {
      key: "SHIPMENT_SENT";
      customer: CustomerContext;
      order: OrderContext;
      shipment: ShipmentContext;
    }
  | {
      key: "CREDIT_AVAILABLE";
      customer: CustomerContext;
      credit: CreditContext;
    };

const TEMPLATE_LABELS: Record<OrderTemplateKey, string> = {
  SEPARATION_PENDING_VALIDATION: "Separación pendiente de validación",
  SEPARATION_CONFIRMED: "Separación confirmada",
  BALANCE_REMINDER: "Recordatorio de saldo",
  RESERVATION_NEAR_EXPIRY: "Reserva por vencer",
  RESERVATION_EXPIRED: "Reserva vencida",
  PAYMENT_VALIDATED: "Pago validado",
  SHIPMENT_SENT: "Pedido enviado",
  CREDIT_AVAILABLE: "Crédito disponible",
};

const TEMPLATE_DESCRIPTIONS: Record<OrderTemplateKey, string> = {
  SEPARATION_PENDING_VALIDATION: "Confirma que la separación está a la espera de validar el pago.",
  SEPARATION_CONFIRMED: "Avisa que el adelanto fue validado y la reserva está asegurada.",
  BALANCE_REMINDER: "Recuerda el saldo pendiente del pedido.",
  RESERVATION_NEAR_EXPIRY: "Avisa que la reserva está por vencer.",
  RESERVATION_EXPIRED: "Comunica que la reserva venció y se va a liberar.",
  PAYMENT_VALIDATED: "Confirma que el pago completo fue validado.",
  SHIPMENT_SENT: "Avisa que el pedido ya fue enviado con agencia y tracking.",
  CREDIT_AVAILABLE: "Informa sobre crédito disponible para la siguiente compra.",
};

export const WHATSAPP_TEMPLATE_KEYS: OrderTemplateKey[] = [
  "SEPARATION_PENDING_VALIDATION",
  "SEPARATION_CONFIRMED",
  "BALANCE_REMINDER",
  "RESERVATION_NEAR_EXPIRY",
  "RESERVATION_EXPIRED",
  "PAYMENT_VALIDATED",
  "SHIPMENT_SENT",
  "CREDIT_AVAILABLE",
];

export function getTemplateLabel(key: OrderTemplateKey): string {
  return TEMPLATE_LABELS[key];
}

export function getTemplateDescription(key: OrderTemplateKey): string {
  return TEMPLATE_DESCRIPTIONS[key];
}

function line(label: string, value: string): string {
  return `${label}: ${value}`;
}

export function buildWhatsappMessage(input: BuildTemplateInput): string {
  const customerName = safe(input.customer.name, "Hola");
  const greeting = `¡Hola, ${customerName}! 👋`;

  switch (input.key) {
    case "SEPARATION_PENDING_VALIDATION": {
      const lines = [
        greeting,
        `Te escribimos de *${STORE_NAME}*. Tu separación *${safe(
          input.order.orderNumber,
        )}* está registrada y estamos validando tu pago.`,
        line("Total", money(input.order.total)),
        line("Vence", longDate(input.order.expiresAt)),
        "Te avisaremos en cuanto confirmemos el pago. ¡Gracias por tu compra! 💜",
      ];
      return lines.filter(Boolean).join("\n");
    }
    case "SEPARATION_CONFIRMED": {
      const lines = [
        greeting,
        `¡Buenas noticias! Validamos tu adelanto y tu separación *${safe(
          input.order.orderNumber,
        )}* está confirmada.`,
        line("Pago", money(input.payment.amount)),
        line("Método", PAYMENT_METHOD_LABELS[input.payment.method] ?? "—"),
        input.payment.operationNumber
          ? line("N° de operación", safe(input.payment.operationNumber))
          : "",
        line("Total", money(input.order.total)),
        line("Saldo", money(input.order.balance)),
        line("Reserva hasta", longDate(input.order.expiresAt)),
        "Pronto te contactaremos con los siguientes pasos. ¡Gracias! 💜",
      ];
      return lines.filter(Boolean).join("\n");
    }
    case "BALANCE_REMINDER": {
      const lines = [
        greeting,
        `Pasamos a recordarte el saldo pendiente de tu pedido *${safe(
          input.order.orderNumber,
        )}*.`,
        line("Total", money(input.order.total)),
        line("Validado", money(input.order.validatedPaid ?? "0")),
        line("Saldo", money(input.order.balance)),
        line("Vence", longDate(input.order.expiresAt)),
        "Si ya realizaste el pago, por favor ignora este mensaje. ¡Gracias!",
      ];
      return lines.filter(Boolean).join("\n");
    }
    case "RESERVATION_NEAR_EXPIRY": {
      const lines = [
        greeting,
        `Tu reserva del pedido *${safe(
          input.order.orderNumber,
        )}* está por vencer.`,
        line("Vence", longDate(input.order.expiresAt)),
        line("Saldo", money(input.order.balance)),
        "Si deseas mantenerla separada, te pedimos completar el pago antes de la fecha. ¡Gracias!",
      ];
      return lines.filter(Boolean).join("\n");
    }
    case "RESERVATION_EXPIRED": {
      const lines = [
        greeting,
        `Lamentamos informarte que la reserva de tu pedido *${safe(
          input.order.orderNumber,
        )}* venció el ${longDate(input.order.expiresAt)} y vamos a liberarla.`,
        "Si aún te interesa la cartera, escríbenos y vemos cómo ayudarte. 💜",
      ];
      return lines.filter(Boolean).join("\n");
    }
    case "PAYMENT_VALIDATED": {
      const lines = [
        greeting,
        `Confirmamos el pago completo de tu pedido *${safe(input.order.orderNumber)}*.`,
        line("Pago", money(input.payment.amount)),
        line("Método", PAYMENT_METHOD_LABELS[input.payment.method] ?? "—"),
        input.payment.operationNumber
          ? line("N° de operación", safe(input.payment.operationNumber))
          : "",
        "¡Gracias por tu compra! Te avisaremos cuando entreguemos el pedido.",
      ];
      return lines.filter(Boolean).join("\n");
    }
    case "SHIPMENT_SENT": {
      const lines = [
        greeting,
        `¡Tu pedido *${safe(input.order.orderNumber)}* ya está en camino! 🚚`,
        line("Método", SHIPPING_METHOD_LABELS[input.shipment.shippingMethod] ?? "—"),
        input.shipment.agencyName ? line("Agencia", safe(input.shipment.agencyName)) : "",
        input.shipment.trackingCode ? line("Tracking", safe(input.shipment.trackingCode)) : "",
        input.shipment.expectedDelivery
          ? line("Entrega estimada", longDate(input.shipment.expectedDelivery))
          : "",
        "Te avisaremos cuando se confirme la entrega. ¡Gracias!",
      ];
      return lines.filter(Boolean).join("\n");
    }
    case "CREDIT_AVAILABLE": {
      const lines = [
        greeting,
        `Tienes crédito disponible en *${STORE_NAME}* por un pago validado.`,
        line("Total del crédito", money(input.credit.totalAmount)),
        line("Disponible", money(input.credit.availableAmount)),
        "Puedes usarlo en tu próxima compra solo indícanos al momento de separar.",
      ];
      return lines.filter(Boolean).join("\n");
    }
  }
}

export function getAvailableTemplates(
  context: AvailableContext,
): OrderTemplateKey[] {
  if (!context.hasOrder) {
    return context.hasCredit ? ["CREDIT_AVAILABLE"] : [];
  }
  const all: OrderTemplateKey[] = [...WHATSAPP_TEMPLATE_KEYS];
  if (!context.hasPayment) {
    return all.filter(
      (k) => k !== "SEPARATION_CONFIRMED" && k !== "PAYMENT_VALIDATED",
    );
  }
  if (!context.hasShipment) {
    return all.filter((k) => k !== "SHIPMENT_SENT");
  }
  if (!context.hasCredit) {
    return all.filter((k) => k !== "CREDIT_AVAILABLE");
  }
  return all;
}

export type AvailableContext = {
  hasOrder: boolean;
  hasPayment: boolean;
  hasShipment: boolean;
  hasCredit: boolean;
};

export { date, longDate, money, safe };
