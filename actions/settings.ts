"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole, getCurrentUser } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { invalidateSettingsCache, getSettings } from "@/lib/settings";
import { BusinessSettingsSchema } from "@/lib/validations";
import { auditAfter } from "@/lib/audit";

export type SettingsActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Partial<Record<keyof z.infer<typeof BusinessSettingsSchema>, string>>;
};

const initialState: SettingsActionState = { ok: false };

function readArray(formData: FormData, key: string): string[] {
  return formData.getAll(key).map((v) => String(v));
}

function readBoolean(formData: FormData, key: string): boolean {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function readString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

type SettingsForAudit = z.infer<typeof BusinessSettingsSchema>;

function serializeSettings(s: SettingsForAudit) {
  return {
    reservationDays: s.reservationDays,
    minimumAdvance: String(s.minimumAdvance),
    currency: s.currency,
    freeShippingEnabled: s.freeShippingEnabled,
    freeShippingThreshold: String(s.freeShippingThreshold),
    productCodePrefix: s.productCodePrefix,
    allowOverpaymentCredit: s.allowOverpaymentCredit,
    allowRefund: s.allowRefund,
    enabledPaymentMethods: [...s.enabledPaymentMethods],
    enabledShippingMethods: [...s.enabledShippingMethods],
    paymentValidatorRoles: [...s.paymentValidatorRoles],
  };
}

type SettingsRow = Awaited<ReturnType<typeof getSettings>>;

function serializeSettingsRow(s: SettingsRow) {
  return {
    reservationDays: s.reservationDays,
    minimumAdvance: s.minimumAdvance.toString(),
    currency: s.currency,
    freeShippingEnabled: s.freeShippingEnabled,
    freeShippingThreshold: s.freeShippingThreshold.toString(),
    productCodePrefix: s.productCodePrefix,
    allowOverpaymentCredit: s.allowOverpaymentCredit,
    allowRefund: s.allowRefund,
    enabledPaymentMethods: [...s.enabledPaymentMethods],
    enabledShippingMethods: [...s.enabledShippingMethods],
    paymentValidatorRoles: [...s.paymentValidatorRoles],
  };
}

function parseInput(formData: FormData) {
  return {
    reservationDays: readString(formData, "reservationDays"),
    minimumAdvance: readString(formData, "minimumAdvance"),
    currency: readString(formData, "currency").toUpperCase(),
    freeShippingEnabled: readBoolean(formData, "freeShippingEnabled"),
    freeShippingThreshold: readString(formData, "freeShippingThreshold"),
    productCodePrefix: readString(formData, "productCodePrefix").toUpperCase(),
    allowOverpaymentCredit: readBoolean(formData, "allowOverpaymentCredit"),
    allowRefund: readBoolean(formData, "allowRefund"),
    enabledPaymentMethods: readArray(formData, "enabledPaymentMethods"),
    enabledShippingMethods: readArray(formData, "enabledShippingMethods"),
    paymentValidatorRoles: readArray(formData, "paymentValidatorRoles"),
  };
}

export async function updateSettingsAction(
  _prev: SettingsActionState | undefined,
  formData: FormData,
): Promise<SettingsActionState> {
  await requireRole("ADMIN");

  const parsed = BusinessSettingsSchema.safeParse(parseInput(formData));
  if (!parsed.success) {
    const fieldErrors: SettingsActionState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof z.infer<typeof BusinessSettingsSchema> | undefined;
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      ok: false,
      message: "Revisa los datos del formulario.",
      fieldErrors,
    };
  }

  const previous = await getSettings();
  const data = parsed.data;
  const user = await getCurrentUser();
  void previous;

  const prisma = getPrisma();
  await prisma.businessSettings.upsert({
    where: { id: "default" },
    update: {
      reservationDays: data.reservationDays,
      minimumAdvance: data.minimumAdvance,
      currency: data.currency,
      freeShippingEnabled: data.freeShippingEnabled,
      freeShippingThreshold: data.freeShippingThreshold,
      productCodePrefix: data.productCodePrefix,
      allowOverpaymentCredit: data.allowOverpaymentCredit,
      allowRefund: data.allowRefund,
      enabledPaymentMethods: data.enabledPaymentMethods,
      enabledShippingMethods: data.enabledShippingMethods,
      paymentValidatorRoles: data.paymentValidatorRoles,
    },
    create: {
      id: "default",
      reservationDays: data.reservationDays,
      minimumAdvance: data.minimumAdvance,
      currency: data.currency,
      freeShippingEnabled: data.freeShippingEnabled,
      freeShippingThreshold: data.freeShippingThreshold,
      productCodePrefix: data.productCodePrefix,
      allowOverpaymentCredit: data.allowOverpaymentCredit,
      allowRefund: data.allowRefund,
      enabledPaymentMethods: data.enabledPaymentMethods,
      enabledShippingMethods: data.enabledShippingMethods,
      paymentValidatorRoles: data.paymentValidatorRoles,
    },
  });

  invalidateSettingsCache();
  revalidatePath("/configuracion");
  auditAfter(user?.id ?? null, {
    action: "SETTINGS_UPDATED",
    entity: "BusinessSettings",
    entityId: "default",
    metadata: {
      previous: serializeSettingsRow(previous),
      next: serializeSettings(data),
    },
  });

  return { ok: true, message: "Configuración guardada." };
}

export async function getSettingsAction() {
  await requireRole("ADMIN");
  const settings = await getSettings();
  return settings;
}

export const initialSettingsState: SettingsActionState = initialState;
