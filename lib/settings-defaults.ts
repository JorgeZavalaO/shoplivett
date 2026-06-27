// Defaults de BusinessSettings. Usados por el seed y por getSettings() como upsert.
import type {
  CostAllocationMethod,
  PaymentMethod,
  Prisma,
  Role,
  SalesChannel,
  ShippingMethod,
} from "@prisma/client";

export type BusinessSettingsData = {
  reservationDays: number;
  minimumAdvance: string;
  currency: string;
  freeShippingEnabled: boolean;
  freeShippingThreshold: string;
  productCodePrefix: string;
  allowOverpaymentCredit: boolean;
  allowRefund: boolean;
  enabledPaymentMethods: PaymentMethod[];
  enabledShippingMethods: ShippingMethod[];
  paymentValidatorRoles: Role[];
  defaultExchangeRate: string;
  minimumTargetMarginBps: number;
  objectiveTargetMarginBps: number;
  defaultCostAllocationMethod: CostAllocationMethod;
  mixedValueAllocationPercent: number;
  mixedWeightAllocationPercent: number;
  standardPackagingCostPen: string;
  paymentMethodFees: PaymentMethodFees;
  enabledSalesChannels: SalesChannel[];
};

export type PaymentMethodFees = Record<PaymentMethod, number>;

export const DEFAULT_PAYMENT_METHOD_FEES: PaymentMethodFees = {
  YAPE: 0,
  PLIN: 0,
  CASH: 0,
  OTHER: 0,
};

export const DEFAULT_BUSINESS_SETTINGS: BusinessSettingsData = {
  reservationDays: 5,
  minimumAdvance: "50.00",
  currency: "PEN",
  freeShippingEnabled: true,
  freeShippingThreshold: "150.00",
  productCodePrefix: "CART",
  allowOverpaymentCredit: true,
  allowRefund: true,
  enabledPaymentMethods: ["YAPE", "PLIN"],
  enabledShippingMethods: [
    "DELIVERY_PROPIO",
    "OLVA",
    "SHALOM",
    "MOTORIZADO",
    "RECOJO",
  ],
  paymentValidatorRoles: ["ADMIN", "SELLER"],
  defaultExchangeRate: "3.7500",
  minimumTargetMarginBps: 1500,
  objectiveTargetMarginBps: 3000,
  defaultCostAllocationMethod: "MIXED",
  mixedValueAllocationPercent: 50,
  mixedWeightAllocationPercent: 50,
  standardPackagingCostPen: "2.00",
  paymentMethodFees: { ...DEFAULT_PAYMENT_METHOD_FEES },
  enabledSalesChannels: [
    "TIKTOK_LIVE",
    "INSTAGRAM_LIVE",
    "TIENDA",
    "WHATSAPP_DIRECTO",
  ],
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  YAPE: "Yape",
  PLIN: "Plin",
  CASH: "Efectivo",
  OTHER: "Otro",
};

export const SHIPPING_METHOD_LABELS: Record<ShippingMethod, string> = {
  DELIVERY_PROPIO: "Delivery propio",
  OLVA: "Olva",
  SHALOM: "Shalom",
  MOTORIZADO: "Motorizado por aplicativo",
  RECOJO: "Recojo en tienda",
};

export const SALES_CHANNEL_LABELS: Record<SalesChannel, string> = {
  TIKTOK_LIVE: "TikTok Live",
  INSTAGRAM_LIVE: "Instagram Live",
  TIENDA: "Tienda física",
  WHATSAPP_DIRECTO: "WhatsApp directo",
  OTRO: "Otro",
};

export const COST_ALLOCATION_METHOD_LABELS: Record<CostAllocationMethod, string> = {
  BY_VALUE: "Por valor de items",
  BY_WEIGHT: "Por peso de items",
  MIXED: "Mixto (valor + peso)",
  MANUAL: "Manual por item",
};

export function paymentMethodFeesToJson(
  fees: PaymentMethodFees,
): Prisma.InputJsonValue {
  return { ...fees };
}

export function coercePaymentMethodFees(
  value: unknown,
): PaymentMethodFees {
  const result: PaymentMethodFees = { ...DEFAULT_PAYMENT_METHOD_FEES };
  if (!value || typeof value !== "object") return result;
  const obj = value as Record<string, unknown>;
  for (const method of Object.keys(DEFAULT_PAYMENT_METHOD_FEES) as PaymentMethod[]) {
    const raw = obj[method];
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) {
      result[method] = Math.trunc(n);
    }
  }
  return result;
}
