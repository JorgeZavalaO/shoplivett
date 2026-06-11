// Validadores Zod centralizados.
import { z } from "zod";
import { CustomerStatus, PaymentMethod, Role, ShippingMethod } from "@prisma/client";

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof PaginationSchema>;

export const LoginSchema = z.object({
  email: z
    .string({ message: "El correo es obligatorio." })
    .min(1, "El correo es obligatorio.")
    .email("Ingresa un correo válido."),
  password: z
    .string({ message: "La contraseña es obligatoria." })
    .min(6, "La contraseña debe tener al menos 6 caracteres."),
});

export type LoginInput = z.infer<typeof LoginSchema>;

// Helpers para strings que representan montos en formato decimal (12,2).
const decimalString = (opts: { min?: number; label: string; allowZero?: boolean }) =>
  z
    .string()
    .trim()
    .min(1, `${opts.label} es obligatorio.`)
    .refine((s) => /^\d+(\.\d{1,2})?$/.test(s), {
      message: `${opts.label} debe tener hasta 2 decimales.`,
    })
    .transform((s) => s)
    .refine(
      (s) => {
        const n = Number(s);
        if (Number.isNaN(n)) return false;
        if (!opts.allowZero && n <= 0) return false;
        if (opts.allowZero && n < 0) return false;
        if (opts.min !== undefined && n < opts.min) return false;
        return true;
      },
      {
        message: opts.allowZero
          ? `${opts.label} no puede ser negativo.`
          : `${opts.label} debe ser mayor a 0.`,
      },
    );

export const BusinessSettingsSchema = z.object({
  reservationDays: z.coerce
    .number({ message: "Los días de reserva son obligatorios." })
    .int("Debe ser un número entero.")
    .min(1, "Debe ser al menos 1 día.")
    .max(60, "Máximo 60 días."),
  minimumAdvance: decimalString({ label: "El adelanto mínimo", min: 0.01 }),
  currency: z
    .string()
    .trim()
    .length(3, "La moneda debe tener 3 letras.")
    .regex(/^[A-Z]{3}$/, "Usa un código de moneda en mayúsculas (ej. PEN)."),
  freeShippingEnabled: z.boolean(),
  freeShippingThreshold: decimalString({
    label: "El monto mínimo para envío gratis",
    allowZero: true,
  }),
  productCodePrefix: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres.")
    .max(6, "Máximo 6 caracteres.")
    .regex(/^[A-Z0-9-]+$/, "Solo mayúsculas, números y guiones."),
  allowOverpaymentCredit: z.boolean(),
  allowRefund: z.boolean(),
  enabledPaymentMethods: z
    .array(z.enum(PaymentMethod))
    .min(1, "Selecciona al menos un medio de pago."),
  enabledShippingMethods: z
    .array(z.enum(ShippingMethod))
    .min(1, "Selecciona al menos un medio de envío."),
  paymentValidatorRoles: z
    .array(z.enum(Role))
    .min(1, "Selecciona al menos un rol que pueda validar pagos."),
});

export type BusinessSettingsInput = z.infer<typeof BusinessSettingsSchema>;

// =====================================================================
// Customers
// =====================================================================

const optionalString = z
  .string()
  .trim()
  .max(120, "Máximo 120 caracteres.")
  .optional()
  .or(z.literal("").transform(() => undefined));

const optionalLongString = z
  .string()
  .trim()
  .max(500, "Máximo 500 caracteres.")
  .optional()
  .or(z.literal("").transform(() => undefined));

export const CustomerStatusSchema = z.enum(CustomerStatus);

const whatsappInputSchema = z
  .string({ message: "El WhatsApp es obligatorio." })
  .trim()
  .min(8, "El WhatsApp es obligatorio.")
  .max(20, "Máximo 20 caracteres.");

const customerBaseShape = {
  name: z
    .string({ message: "El nombre es obligatorio." })
    .trim()
    .min(2, "Mínimo 2 caracteres.")
    .max(100, "Máximo 100 caracteres."),
  whatsapp: whatsappInputSchema,
  document: optionalString,
  address: optionalLongString,
  district: optionalString,
  reference: optionalLongString,
  channel: optionalString,
  notes: optionalLongString,
};

export const CustomerCreateSchema = z.object({
  ...customerBaseShape,
});

export const CustomerUpdateSchema = z.object({
  ...customerBaseShape,
  status: CustomerStatusSchema.optional(),
});

export type CustomerCreateInput = z.infer<typeof CustomerCreateSchema>;
export type CustomerUpdateInput = z.infer<typeof CustomerUpdateSchema>;
