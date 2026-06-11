"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { invalidateSettingsCache, getSettings } from "@/lib/settings";
import { BusinessSettingsSchema } from "@/lib/validations";

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

  // TODO(Sprint 14): registrar auditoría con { previous, next } aquí.
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

  return { ok: true, message: "Configuración guardada." };
}

export async function getSettingsAction() {
  await requireRole("ADMIN");
  const settings = await getSettings();
  return settings;
}

export const initialSettingsState: SettingsActionState = initialState;
