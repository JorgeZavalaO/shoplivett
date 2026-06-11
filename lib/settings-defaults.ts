// Defaults de BusinessSettings. Usados por el seed y por getSettings() como upsert.
import type { PaymentMethod, Role, ShippingMethod } from "@prisma/client";

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
