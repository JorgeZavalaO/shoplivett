// Validadores Zod centralizados.
import { z } from "zod";
import {
  CustomerStatus,
  LiveChannel,
  PaymentMethod,
  Role,
  ShippingMethod,
} from "@prisma/client";

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

// =====================================================================
// Categories
// =====================================================================

export const CategoryCreateSchema = z.object({
  name: z
    .string({ message: "El nombre es obligatorio." })
    .trim()
    .min(2, "Mínimo 2 caracteres.")
    .max(60, "Máximo 60 caracteres."),
});

export const CategoryUpdateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres.")
    .max(60, "Máximo 60 caracteres."),
  isActive: z
    .union([z.boolean(), z.literal("on"), z.literal("true"), z.literal("false")])
    .transform((v) => v === true || v === "on" || v === "true")
    .optional(),
});

export type CategoryCreateInput = z.infer<typeof CategoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof CategoryUpdateSchema>;

// =====================================================================
// Products
// =====================================================================

const optionalShort = z
  .string()
  .trim()
  .max(60, "Máximo 60 caracteres.")
  .optional()
  .or(z.literal("").transform(() => undefined));

const optionalDescription = z
  .string()
  .trim()
  .max(2000, "Máximo 2000 caracteres.")
  .optional()
  .or(z.literal("").transform(() => undefined));

export const ProductCreateSchema = z.object({
  name: z
    .string({ message: "El nombre es obligatorio." })
    .trim()
    .min(2, "Mínimo 2 caracteres.")
    .max(120, "Máximo 120 caracteres."),
  description: optionalDescription,
  categoryId: z
    .string({ message: "Selecciona una categoría." })
    .min(1, "Selecciona una categoría."),
});

export const ProductUpdateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres.")
    .max(120, "Máximo 120 caracteres."),
  description: optionalDescription,
  categoryId: z.string().min(1, "Selecciona una categoría."),
  isActive: z
    .union([z.boolean(), z.literal("on"), z.literal("true"), z.literal("false")])
    .transform((v) => v === true || v === "on" || v === "true")
    .optional(),
});

export type ProductCreateInput = z.infer<typeof ProductCreateSchema>;
export type ProductUpdateInput = z.infer<typeof ProductUpdateSchema>;

// =====================================================================
// Product Variants
// =====================================================================

const decimalPrice = (opts: { label: string; required: boolean }) => {
  if (!opts.required) {
    return z
      .string()
      .trim()
      .max(20)
      .optional()
      .or(z.literal("").transform(() => undefined))
      .refine(
        (s) => s === undefined || /^\d+(\.\d{1,2})?$/.test(s!),
        { message: `${opts.label} debe tener hasta 2 decimales.` },
      );
  }
  return decimalString({ label: opts.label, min: 0.01 }).pipe(
    z.string().min(1, `${opts.label} es obligatorio.`),
  );
};

const optionalBarcode = z
  .string()
  .trim()
  .max(40, "Máximo 40 caracteres.")
  .optional()
  .or(z.literal("").transform(() => undefined));

export const ProductVariantCreateSchema = z.object({
  productId: z.string().min(1, "Falta el producto."),
  color: optionalShort,
  material: optionalShort,
  size: optionalShort,
  price: decimalPrice({ label: "El precio de venta", required: true }),
  cost: decimalPrice({ label: "El costo", required: false }),
  stock: z.coerce
    .number({ message: "El stock inicial es obligatorio." })
    .int("Debe ser un número entero.")
    .min(0, "El stock no puede ser negativo.")
    .max(100000, "Stock máximo 100000."),
  barcode: optionalBarcode,
});

export const ProductVariantUpdateSchema = z.object({
  color: optionalShort,
  material: optionalShort,
  size: optionalShort,
  price: decimalPrice({ label: "El precio de venta", required: true }),
  cost: decimalPrice({ label: "El costo", required: false }),
  barcode: optionalBarcode,
  status: z.enum(["ACTIVE", "HIDDEN", "ARCHIVED"]).optional(),
});

export type ProductVariantCreateInput = z.infer<typeof ProductVariantCreateSchema>;
export type ProductVariantUpdateInput = z.infer<typeof ProductVariantUpdateSchema>;

// =====================================================================
// Inventory adjustments
// =====================================================================

export const InventoryAdjustSchema = z
  .object({
    type: z.enum(["IN", "ADJUSTMENT"]),
    quantity: z.coerce
      .number({ message: "La cantidad es obligatoria." })
      .int("Debe ser un número entero.")
      .refine((n) => n !== 0, { message: "La cantidad no puede ser cero." })
      .refine((n) => Math.abs(n) <= 100000, { message: "Cantidad fuera de rango." }),
    reason: z
      .string({ message: "El motivo es obligatorio." })
      .trim()
      .min(5, "El motivo debe tener al menos 5 caracteres.")
      .max(200, "Máximo 200 caracteres."),
  })
  .superRefine((data, ctx) => {
    if (data.type === "IN" && data.quantity < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["quantity"],
        message: "Para INGRESO la cantidad debe ser positiva.",
      });
    }
  })
  .transform((data) => ({
    ...data,
    signedQuantity: data.type === "IN" ? Math.abs(data.quantity) : data.quantity,
  }));

export type InventoryAdjustInput = z.infer<typeof InventoryAdjustSchema>;

// =====================================================================
// Live sessions
// =====================================================================

export const LiveChannelSchema = z.enum(LiveChannel);

export const LiveSessionCreateSchema = z.object({
  name: z
    .string({ message: "El nombre del live es obligatorio." })
    .trim()
    .min(3, "Mínimo 3 caracteres.")
    .max(120, "Máximo 120 caracteres."),
  channel: LiveChannelSchema,
  responsibleId: z
    .string()
    .trim()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  notes: z
    .string()
    .trim()
    .max(1000, "Máximo 1000 caracteres.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export const LiveSessionUpdateSchema = LiveSessionCreateSchema;

export type LiveSessionCreateInput = z.infer<typeof LiveSessionCreateSchema>;
export type LiveSessionUpdateInput = z.infer<typeof LiveSessionUpdateSchema>;

// =====================================================================
// Quick sale / orders
// =====================================================================

const decimalOptional = z
  .string()
  .trim()
  .refine((s) => s === "" || /^\d+(\.\d{1,2})?$/.test(s), {
    message: "Debe tener hasta 2 decimales.",
  })
  .transform((s) => (s === "" ? "0" : s));

export const SaleItemSchema = z.object({
  variantId: z.string().min(1, "Falta la variante."),
  quantity: z.coerce
    .number({ message: "La cantidad es obligatoria." })
    .int("Debe ser un número entero.")
    .min(1, "Mínimo 1.")
    .max(1000, "Máximo 1000."),
});

export const CreateOrderSchema = z
  .object({
    customerId: z.string().min(1, "Selecciona una clienta."),
    liveSessionId: z
      .string()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    items: z
      .string()
      .min(1, "Agrega al menos un producto.")
      .transform((s) => {
        try { return JSON.parse(s) as { variantId: string; quantity: number }[]; }
        catch { return []; }
      }),
    discount: decimalOptional,
    shippingAmount: decimalOptional,
    advanceAmount: z
      .string({ message: "El adelanto es obligatorio." })
      .min(1, "El adelanto es obligatorio.")
      .refine((s) => /^\d+(\.\d{1,2})?$/.test(s), {
        message: "El adelanto debe tener hasta 2 decimales.",
      }),
    paymentMethod: z.enum(PaymentMethod, { message: "Selecciona un método de pago." }),
    operationNumber: z.string().trim().max(60).optional().or(z.literal("").transform(() => undefined)),
    notes: z.string().trim().max(1000).optional().or(z.literal("").transform(() => undefined)),
  })
  .superRefine((data, ctx) => {
    if (!Array.isArray(data.items) || data.items.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items"],
        message: "Agrega al menos un producto.",
      });
      return;
    }
    const ids = new Set<string>();
    for (const item of data.items) {
      if (!item?.variantId) continue;
      if (ids.has(item.variantId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items"],
          message: "No repitas la misma variante.",
        });
      }
      ids.add(item.variantId);
    }
  });

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
