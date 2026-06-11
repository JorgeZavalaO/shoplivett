// Helpers para resumen de cliente: deuda acumulada y crédito disponible.
// Los modelos Order y CustomerCredit entran en Sprints 7 y 9; mientras
// tanto estas funciones devuelven 0.00 para que la UI ya muestre los indicadores.

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

export async function getCustomerDebt(_customerId: string): Promise<string> {
  // Sprint 7 introduce Order. Cuando exista, aquí se sumará el balance de pedidos activos.
  void _customerId;
  return ZERO;
}

export async function getCustomerCredit(_customerId: string): Promise<string> {
  // Sprint 9 introduce CustomerCredit. Cuando exista, aquí se sumará el crédito disponible.
  void _customerId;
  return ZERO;
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
