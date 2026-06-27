// Constantes y tipos de Expenses seguros para cliente.
// NO importar nada de Prisma aquí (este archivo se usa también en componentes client).

import type { ExpenseCategory, ExpenseType } from "@prisma/client";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  RENT: "Alquiler",
  PAYROLL: "Sueldos",
  ADVERTISING: "Publicidad",
  UTILITIES: "Servicios (luz, agua)",
  INTERNET: "Internet y telefonia",
  PACKAGING: "Material de empaque",
  SHIPPING: "Envios",
  OFFICE_SUPPLIES: "Utiles de oficina",
  PROFESSIONAL_SERVICES: "Servicios profesionales",
  TAXES: "Impuestos y tasas",
  MAINTENANCE: "Mantenimiento",
  OTHER: "Otros",
};

export const EXPENSE_TYPE_LABELS: Record<ExpenseType, string> = {
  FIXED: "Fijo",
  VARIABLE: "Variable",
};

export const EXPENSE_CATEGORY_OPTIONS: Array<{
  value: ExpenseCategory;
  label: string;
}> = (Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map((key) => ({
  value: key,
  label: EXPENSE_CATEGORY_LABELS[key],
}));

export const EXPENSE_TYPE_OPTIONS: Array<{
  value: ExpenseType;
  label: string;
}> = (Object.keys(EXPENSE_TYPE_LABELS) as ExpenseType[]).map((key) => ({
  value: key,
  label: EXPENSE_TYPE_LABELS[key],
}));
