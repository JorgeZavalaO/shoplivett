// Enums compartidos del dominio. Se ampliarán en los siguientes sprints.

export const OrderStatus = {
  PAYMENT_VALIDATION_PENDING: "PAYMENT_VALIDATION_PENDING",
  RESERVED: "RESERVED",
  PAID: "PAID",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
  SHIPPED: "SHIPPED",
  DELIVERED: "DELIVERED",
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const PaymentMethod = {
  YAPE: "YAPE",
  PLIN: "PLIN",
  CASH: "CASH",
  OTHER: "OTHER",
} as const;

export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PaymentStatus = {
  PENDING: "PENDING",
  VALIDATED: "VALIDATED",
  REJECTED: "REJECTED",
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const CustomerStatus = {
  ACTIVE: "ACTIVE",
  FREQUENT: "FREQUENT",
  RISKY: "RISKY",
  BLOCKED: "BLOCKED",
} as const;

export type CustomerStatus =
  (typeof CustomerStatus)[keyof typeof CustomerStatus];
