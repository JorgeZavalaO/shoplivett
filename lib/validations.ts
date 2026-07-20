// Validadores Zod centralizados.
import { z } from "zod";
import {
  CostAllocationMethod,
  CustomerStatus,
  ExpenseCategory,
  ExpenseType,
  IncidentReturnDecision,
  IncidentStatus,
  IncidentType,
  LiveChannel,
  PaymentMethod,
  Role,
  SalesChannel,
  ShippingMethod,
} from "@prisma/client";

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof PaginationSchema>;

// Re-export para no romper imports existentes.
// El esquema vive en lib/validations/auth.ts para que pueda ser consumido
// desde el middleware (Edge runtime) sin arrastrar el cliente de Prisma.
export { LoginSchema, type LoginInput } from "@/lib/validations/auth";

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

export const BusinessSettingsSchema = z
  .object({
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
    defaultExchangeRate: z
      .string()
      .trim()
      .min(1, "El tipo de cambio es obligatorio.")
      .refine((s) => /^\d+(\.\d{1,4})?$/.test(s), {
        message: "El tipo de cambio debe tener hasta 4 decimales.",
      })
      .refine((s) => Number(s) > 0, {
        message: "El tipo de cambio debe ser mayor a 0.",
      }),
    minimumTargetMarginBps: z.coerce
      .number({ message: "El margen mínimo es obligatorio." })
      .int("Debe ser un número entero.")
      .min(0, "No puede ser negativo.")
      .max(10000, "Máximo 10000 (100%)."),
    objectiveTargetMarginBps: z.coerce
      .number({ message: "El margen objetivo es obligatorio." })
      .int("Debe ser un número entero.")
      .min(0, "No puede ser negativo.")
      .max(10000, "Máximo 10000 (100%)."),
    defaultCostAllocationMethod: z.enum(CostAllocationMethod, {
      message: "Selecciona un método de asignación.",
    }),
    mixedValueAllocationPercent: z.coerce
      .number({ message: "El porcentaje de valor es obligatorio." })
      .int("Debe ser un número entero.")
      .min(0, "No puede ser negativo.")
      .max(100, "Máximo 100."),
    mixedWeightAllocationPercent: z.coerce
      .number({ message: "El porcentaje de peso es obligatorio." })
      .int("Debe ser un número entero.")
      .min(0, "No puede ser negativo.")
      .max(100, "Máximo 100."),
    standardPackagingCostPen: decimalString({
      label: "El costo de empaque",
      allowZero: true,
    }),
    paymentMethodFees: z.object({
      YAPE: z.coerce.number().int().min(0).max(10000),
      PLIN: z.coerce.number().int().min(0).max(10000),
      CASH: z.coerce.number().int().min(0).max(10000),
      OTHER: z.coerce.number().int().min(0).max(10000),
    }),
    enabledSalesChannels: z
      .array(z.enum(SalesChannel))
      .min(1, "Selecciona al menos un canal de venta."),
  })
  .superRefine((data, ctx) => {
    if (data.minimumTargetMarginBps > data.objectiveTargetMarginBps) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["minimumTargetMarginBps"],
        message: "El margen mínimo no puede superar al objetivo.",
      });
    }
    if (
      data.defaultCostAllocationMethod === "MIXED" &&
      data.mixedValueAllocationPercent + data.mixedWeightAllocationPercent !==
        100
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mixedValueAllocationPercent"],
        message: "La suma de valor y peso debe ser 100 cuando el método es mixto.",
      });
    }
    if (data.defaultCostAllocationMethod === "MANUAL") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["defaultCostAllocationMethod"],
        message:
          "El metodo Manual por item aun no esta disponible. Usa Por valor, Por peso o Mixto.",
      });
    }
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
  price: decimalPrice({ label: "El precio de venta", required: false }),
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
  price: decimalPrice({ label: "El precio de venta", required: false }),
  cost: decimalPrice({ label: "El costo", required: false }),
  barcode: optionalBarcode,
  status: z.enum(["ACTIVE", "HIDDEN", "ARCHIVED"]).optional(),
});

export type ProductVariantCreateInput = z.infer<typeof ProductVariantCreateSchema>;
export type ProductVariantUpdateInput = z.infer<typeof ProductVariantUpdateSchema>;

// Esquema para el alta combinada: producto base + N variantes en una sola
// pantalla. Las variantes llegan como JSON serializado en el FormData para
// evitar el límite práctico de campos en formularios grandes.
const ProductCreateVariantSchema = z.object({
  color: optionalShort,
  material: optionalShort,
  size: optionalShort,
  price: z
    .string()
    .trim()
    .transform((s) => (s === "" ? "0" : s))
    .pipe(decimalString({ label: "El precio de venta", allowZero: true })),
  cost: decimalString({ label: "El costo", allowZero: true }).optional(),
  stock: z.coerce
    .number({ message: "El stock inicial es obligatorio." })
    .int("Debe ser un número entero.")
    .min(0, "El stock no puede ser negativo.")
    .max(100000, "Stock máximo 100000."),
  barcode: optionalBarcode,
});

export const ProductCreateWithVariantsSchema = z
  .object({
    name: ProductCreateSchema.shape.name,
    description: ProductCreateSchema.shape.description,
    categoryId: ProductCreateSchema.shape.categoryId,
    hasVariants: z
      .union([z.boolean(), z.literal("on"), z.literal("true"), z.literal("false")])
      .transform((v) => v === true || v === "on" || v === "true")
      .default(false),
    variants: z
      .string()
      .transform((raw, ctx) => {
        if (!raw.trim()) return [] as z.infer<typeof ProductCreateVariantSchema>[];
        try {
          const parsed = JSON.parse(raw);
          if (!Array.isArray(parsed)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Lista de variantes inválida.",
            });
            return z.NEVER;
          }
          return parsed;
        } catch {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Lista de variantes inválida.",
          });
          return z.NEVER;
        }
      })
      .pipe(z.array(ProductCreateVariantSchema)),
  })
  .superRefine((data, ctx) => {
    if (data.variants.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["variants"],
        message: "Agrega al menos una variante.",
      });
      return;
    }
    if (!data.hasVariants && data.variants.length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["variants"],
        message: "Si el producto no tiene variantes, solo puede haber una.",
      });
    }
  });

export type ProductCreateWithVariantsInput = z.infer<typeof ProductCreateWithVariantsSchema>;
export type ProductCreateVariantInput = z.infer<typeof ProductCreateVariantSchema>;

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
    salesChannel: z
      .enum(SalesChannel)
      .optional()
      .or(z.literal("").transform(() => undefined)),
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

// =====================================================================
// Import Batches
// =====================================================================

const batchDecimal = (opts: { label: string; allowZero?: boolean }) =>
  z
    .string()
    .trim()
    .min(1, `${opts.label} es obligatorio.`)
    .refine((s) => /^\d+(\.\d{1,2})?$/.test(s), {
      message: `${opts.label} debe tener hasta 2 decimales.`,
    })
    .refine(
      (s) => {
        const n = Number(s);
        if (Number.isNaN(n)) return false;
        if (!opts.allowZero && n <= 0) return false;
        if (opts.allowZero && n < 0) return false;
        return true;
      },
      { message: opts.allowZero ? `${opts.label} no puede ser negativo.` : `${opts.label} debe ser mayor a 0.` },
    );

const batchDecimal4 = (opts: { label: string; allowZero?: boolean }) =>
  z
    .string()
    .trim()
    .min(1, `${opts.label} es obligatorio.`)
    .refine((s) => /^\d+(\.\d{1,4})?$/.test(s), {
      message: `${opts.label} debe tener hasta 4 decimales.`,
    })
    .refine(
      (s) => {
        const n = Number(s);
        if (Number.isNaN(n)) return false;
        if (!opts.allowZero && n <= 0) return false;
        if (opts.allowZero && n < 0) return false;
        return true;
      },
      { message: opts.allowZero ? `${opts.label} no puede ser negativo.` : `${opts.label} debe ser mayor a 0.` },
    );

const optionalDateString = z
  .string()
  .trim()
  .min(1, "Fecha inválida.")
  .optional()
  .or(z.literal("").transform(() => undefined));

export const ImportBatchCreateSchema = z.object({
  purchaseDate: z
    .string({ message: "La fecha de compra es obligatoria." })
    .min(1, "La fecha de compra es obligatoria."),
  estimatedArrivalDate: optionalDateString,
  shopper: z
    .string({ message: "El shopper es obligatorio." })
    .trim()
    .min(2, "Mínimo 2 caracteres.")
    .max(100, "Máximo 100 caracteres."),
  agency: z
    .string({ message: "La agencia es obligatoria." })
    .trim()
    .min(2, "Mínimo 2 caracteres.")
    .max(100, "Máximo 100 caracteres."),
  totalCostUsd: batchDecimal({ label: "El costo total USD" }),
  totalAdditionalCostsUsd: batchDecimal({ label: "Los costos adicionales USD", allowZero: true }),
  totalAdditionalCostsPen: batchDecimal({ label: "Los costos adicionales PEN", allowZero: true }),
  exchangeRate: batchDecimal4({ label: "El tipo de cambio" }),
  notes: z
    .string()
    .trim()
    .max(1000, "Máximo 1000 caracteres.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type ImportBatchCreateInput = z.infer<typeof ImportBatchCreateSchema>;

export const ImportBatchUpdateSchema = z.object({
  purchaseDate: z.string().min(1, "La fecha de compra es obligatoria.").optional(),
  estimatedArrivalDate: optionalDateString,
  shopper: z.string().trim().min(2).max(100).optional(),
  agency: z.string().trim().min(2).max(100).optional(),
  totalCostUsd: batchDecimal({ label: "El costo total USD" }).optional(),
  totalAdditionalCostsUsd: batchDecimal({ label: "Los costos adicionales USD", allowZero: true }).optional(),
  totalAdditionalCostsPen: batchDecimal({ label: "Los costos adicionales PEN", allowZero: true }).optional(),
  exchangeRate: batchDecimal4({ label: "El tipo de cambio" }).optional(),
  status: z.enum(["PURCHASED", "IN_TRANSIT", "COMPLETE", "CLOSED"]).optional(),
  notes: z.string().trim().max(1000).optional().or(z.literal("").transform(() => undefined)),
});

export type ImportBatchUpdateInput = z.infer<typeof ImportBatchUpdateSchema>;

export const ImportBatchItemUpdateSchema = z.object({
  itemId: z.string().min(1, "Falta el identificador del item."),
  quantityReceived: z.coerce
    .number({ message: "La cantidad recibida es obligatoria." })
    .int("Debe ser un número entero.")
    .min(0, "No puede ser negativo.")
    .max(100000, "Máximo 100000."),
  unitCostUsd: batchDecimal4({ label: "El costo unitario USD" }),
  weight: batchDecimal4({ label: "El peso", allowZero: true }),
});

export type ImportBatchItemUpdateInput = z.infer<typeof ImportBatchItemUpdateSchema>;

export const ImportBatchItemSchema = z
  .object({
    variantId: z.string().min(1, "Selecciona una variante."),
    quantityPurchased: z.coerce
      .number({ message: "La cantidad comprada es obligatoria." })
      .int("Debe ser un número entero.")
      .min(1, "Debe ser al menos 1.")
      .max(100000, "Máximo 100000."),
    quantityReceived: z.coerce
      .number({ message: "La cantidad recibida es obligatoria." })
      .int("Debe ser un número entero.")
      .min(0, "No puede ser negativo.")
      .max(100000, "Máximo 100000."),
    unitCostUsd: batchDecimal4({ label: "El costo unitario USD" }),
    weight: batchDecimal4({ label: "El peso", allowZero: true }),
  })
  .superRefine((data, ctx) => {
    if (data.quantityReceived > data.quantityPurchased) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["quantityReceived"],
        message: "La cantidad recibida no puede superar la comprada.",
      });
    }
  });

export type ImportBatchItemInput = z.infer<typeof ImportBatchItemSchema>;

export const ImportBatchItemsSchema = z
  .array(ImportBatchItemSchema)
  .min(1, "Agrega al menos un producto al lote.");

// =====================================================================
// Expenses (Sprint 22)
// =====================================================================

export const ExpenseCategorySchema = z.enum(ExpenseCategory);
export const ExpenseTypeSchema = z.enum(ExpenseType);

export const ExpenseCreateSchema = z.object({
  expenseDate: z
    .string({ message: "La fecha es obligatoria." })
    .min(1, "La fecha es obligatoria."),
  category: ExpenseCategorySchema,
  expenseType: ExpenseTypeSchema.default("VARIABLE"),
  description: z
    .string({ message: "El detalle es obligatorio." })
    .trim()
    .min(3, "Mínimo 3 caracteres.")
    .max(200, "Máximo 200 caracteres."),
  amount: decimalString({ label: "El monto", min: 0.01 }),
  paymentMethod: z
    .string()
    .trim()
    .max(40, "Máximo 40 caracteres.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  notes: z
    .string()
    .trim()
    .max(1000, "Máximo 1000 caracteres.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type ExpenseCreateInput = z.infer<typeof ExpenseCreateSchema>;

export const ExpenseUpdateSchema = z.object({
  expenseDate: z.string().min(1, "La fecha es obligatoria.").optional(),
  category: ExpenseCategorySchema.optional(),
  expenseType: ExpenseTypeSchema.optional(),
  description: z
    .string()
    .trim()
    .min(3, "Mínimo 3 caracteres.")
    .max(200, "Máximo 200 caracteres.")
    .optional(),
  amount: decimalString({ label: "El monto", min: 0.01 }).optional(),
  paymentMethod: z
    .string()
    .trim()
    .max(40, "Máximo 40 caracteres.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  notes: z
    .string()
    .trim()
    .max(1000, "Máximo 1000 caracteres.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type ExpenseUpdateInput = z.infer<typeof ExpenseUpdateSchema>;

export const ExpenseVoidSchema = z.object({
  voidReason: z
    .string()
    .trim()
    .min(5, "El motivo debe tener al menos 5 caracteres.")
    .max(200, "Máximo 200 caracteres."),
});

export type ExpenseVoidInput = z.infer<typeof ExpenseVoidSchema>;

// =====================================================================
// Incidents (Sprint 23)
// =====================================================================

export const IncidentTypeSchema = z.enum(IncidentType);
export const IncidentStatusSchema = z.enum(IncidentStatus);
export const IncidentReturnDecisionSchema = z.enum(IncidentReturnDecision);

const incidentAmount = decimalString({
  label: "El monto",
  allowZero: true,
});

export const IncidentCreateSchema = z
  .object({
    incidentDate: z
      .string({ message: "La fecha es obligatoria." })
      .min(1, "La fecha es obligatoria."),
    type: IncidentTypeSchema,
    decision: IncidentReturnDecisionSchema.default("NONE"),
    orderId: z
      .string()
      .trim()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    orderItemId: z
      .string()
      .trim()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    variantId: z
      .string()
      .trim()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    customerId: z
      .string()
      .trim()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    quantity: z.coerce
      .number({ message: "La cantidad es obligatoria." })
      .int("Debe ser un número entero.")
      .min(1, "Debe ser al menos 1.")
      .max(100000, "Máximo 100000."),
    description: z
      .string({ message: "La descripcion es obligatoria." })
      .trim()
      .min(5, "Mínimo 5 caracteres.")
      .max(500, "Máximo 500 caracteres."),
    recoveredAmount: incidentAmount.optional(),
    lostAmount: incidentAmount.optional(),
    restockQuantity: z.coerce
      .number()
      .int("Debe ser un número entero.")
      .min(0, "No puede ser negativo.")
      .max(100000, "Máximo 100000.")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    notes: z
      .string()
      .trim()
      .max(1000, "Máximo 1000 caracteres.")
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  .superRefine((data, ctx) => {
    if (data.decision === "RESTOCK") {
      if (!data.variantId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["variantId"],
          message: "RESTOCK requiere seleccionar la variante.",
        });
      }
      if (!data.restockQuantity || data.restockQuantity <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["restockQuantity"],
          message: "RESTOCK requiere cantidad a devolver a stock.",
        });
      } else if (data.restockQuantity > data.quantity) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["restockQuantity"],
          message: "La cantidad restock no puede superar la cantidad total.",
        });
      }
    }
    if (data.decision === "CREDIT" && !data.customerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customerId"],
        message: "CREDIT requiere seleccionar la clienta para emitir el credito.",
      });
    }
    if (
      (data.type === "DAMAGE" || data.type === "LOSS") &&
      data.decision === "NONE" &&
      !data.variantId
    ) {
      // Permitimos da&nadas/perdidas sin variante (evento externo); no es bloqueante.
    }
  });

export type IncidentCreateInput = z.infer<typeof IncidentCreateSchema>;

export const IncidentResolveSchema = z.object({
  resolutionNotes: z
    .string()
    .trim()
    .min(3, "Mínimo 3 caracteres.")
    .max(500, "Máximo 500 caracteres.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type IncidentResolveInput = z.infer<typeof IncidentResolveSchema>;

export const IncidentCancelSchema = z.object({
  cancelReason: z
    .string()
    .trim()
    .min(5, "El motivo debe tener al menos 5 caracteres.")
    .max(200, "Máximo 200 caracteres."),
});

export type IncidentCancelInput = z.infer<typeof IncidentCancelSchema>;
