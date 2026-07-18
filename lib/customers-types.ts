// Tipos compartidos del módulo de clientes.
import type { CustomerUpdateSchema } from "@/lib/validations";
import type { z } from "zod";

export type CustomerActionResult = {
  ok: boolean;
  message?: string;
  fieldErrors?: Partial<
    Record<keyof z.infer<typeof CustomerUpdateSchema>, string>
  >;
  whatsappNormalized?: string;
};

export type CustomerListItem = {
  id: string;
  name: string;
  whatsapp: string;
  status: "ACTIVE" | "FREQUENT" | "RISKY" | "BLOCKED";
  isActive: boolean;
  createdAt: Date;
};

export type CustomerListResult = {
  items: CustomerListItem[];
  total: number;
  page: number;
  perPage: number;
  query: string;
};

export const initialCustomerState: CustomerActionResult = { ok: false };
