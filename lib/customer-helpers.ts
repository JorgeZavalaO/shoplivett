// Helpers para resumen de cliente: deuda acumulada y crédito disponible.

import { getPrisma } from "@/lib/prisma";
import { toCents, centsToDecimalString, type Cents } from "@/lib/money";

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
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      name: true,
      whatsapp: true,
      status: true,
      isActive: true,
      createdAt: true,
      document: true,
      address: true,
      district: true,
      reference: true,
      channel: true,
      notes: true,
    },
  });
  if (!customer) return null;

  const [debt, credit] = await Promise.all([
    getCustomerDebt(customerId),
    getCustomerCredit(customerId),
  ]);

  return {
    ...customer,
    debt,
    credit,
  };
}
