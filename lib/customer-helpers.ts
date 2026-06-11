// Helpers para resumen de cliente: deuda acumulada y crédito disponible.

import { getPrisma } from "@/lib/prisma";

const ZERO = "0.00";

export type CustomerSummary = {
  id: string;
  name: string;
  whatsapp: string;
  status: "ACTIVE" | "FREQUENT" | "RISKY" | "BLOCKED";
  isActive: boolean;
  createdAt: Date;
  document: string | null;
  address: string | null;
  district: string | null;
  reference: string | null;
  channel: string | null;
  notes: string | null;
  debt: string;
  credit: string;
};

function toCents(value: string): number {
  const [whole, fraction = ""] = value.trim().split(".");
  const safeWhole = (whole || "0").replace(/[^0-9]/g, "") || "0";
  const safeFraction = (fraction || "").replace(/[^0-9]/g, "").padEnd(2, "0").slice(0, 2);
  return Number(safeWhole) * 100 + Number(safeFraction);
}

function centsToDecimalString(cents: number): string {
  const negative = cents < 0;
  const abs = negative ? -cents : cents;
  const whole = Math.trunc(abs / 100);
  const fraction = Math.trunc(abs % 100);
  const fracStr = String(fraction).padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fracStr}`;
}

export async function getCustomerDebt(customerId: string): Promise<string> {
  const prisma = getPrisma();
  const result = await prisma.order.aggregate({
    where: {
      customerId,
      status: {
        in: ["PAYMENT_VALIDATION_PENDING", "RESERVED", "PARTIALLY_PAID"],
      },
    },
    _sum: { balance: true },
  });
  const sum = result._sum.balance;
  if (!sum) return ZERO;
  return centsToDecimalString(toCents(sum.toString()));
}

export async function getCustomerCredit(customerId: string): Promise<string> {
  const prisma = getPrisma();
  const result = await prisma.customerCredit.aggregate({
    where: {
      customerId,
      status: { in: ["AVAILABLE", "PARTIALLY_USED"] },
    },
    _sum: { availableAmount: true },
  });
  const sum = result._sum.availableAmount;
  if (!sum) return ZERO;
  return centsToDecimalString(toCents(sum.toString()));
}

export async function getCustomerSummary(
  customerId: string,
): Promise<CustomerSummary | null> {
  const prisma = getPrisma();
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) return null;

  const [debt, credit] = await Promise.all([
    getCustomerDebt(customerId),
    getCustomerCredit(customerId),
  ]);

  return {
    id: customer.id,
    name: customer.name,
    whatsapp: customer.whatsapp,
    status: customer.status,
    isActive: customer.isActive,
    createdAt: customer.createdAt,
    document: customer.document,
    address: customer.address,
    district: customer.district,
    reference: customer.reference,
    channel: customer.channel,
    notes: customer.notes,
    debt,
    credit,
  };
}
