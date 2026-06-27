"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { requireRole, getCurrentUser } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { invalidateSettingsCache, getSettings } from "@/lib/settings";
import { BusinessSettingsSchema } from "@/lib/validations";
import {
  coercePaymentMethodFees,
  DEFAULT_PAYMENT_METHOD_FEES,
  type PaymentMethodFees,
} from "@/lib/settings-defaults";
import { auditAfter } from "@/lib/audit";

export type SettingsActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Partial<
    Record<keyof z.infer<typeof BusinessSettingsSchema>, string>
  > & { paymentMethodFees?: string };
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

function readBps(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (value == null || value === "") return "0";
  return String(value).trim();
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
    defaultExchangeRate: String(s.defaultExchangeRate),
    minimumTargetMarginBps: s.minimumTargetMarginBps,
    objectiveTargetMarginBps: s.objectiveTargetMarginBps,
    defaultCostAllocationMethod: s.defaultCostAllocationMethod,
    mixedValueAllocationPercent: s.mixedValueAllocationPercent,
    mixedWeightAllocationPercent: s.mixedWeightAllocationPercent,
    standardPackagingCostPen: String(s.standardPackagingCostPen),
    paymentMethodFees: { ...s.paymentMethodFees },
    enabledSalesChannels: [...s.enabledSalesChannels],
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
    defaultExchangeRate: s.defaultExchangeRate.toString(),
    minimumTargetMarginBps: s.minimumTargetMarginBps,
    objectiveTargetMarginBps: s.objectiveTargetMarginBps,
    defaultCostAllocationMethod: s.defaultCostAllocationMethod,
    mixedValueAllocationPercent: s.mixedValueAllocationPercent,
    mixedWeightAllocationPercent: s.mixedWeightAllocationPercent,
    standardPackagingCostPen: s.standardPackagingCostPen.toString(),
    paymentMethodFees: coercePaymentMethodFees(s.paymentMethodFees),
    enabledSalesChannels: [...s.enabledSalesChannels],
  };
}

function parseInput(formData: FormData) {
  const fees: PaymentMethodFees = { ...DEFAULT_PAYMENT_METHOD_FEES };
  for (const method of Object.keys(fees) as Array<keyof PaymentMethodFees>) {
    const raw = formData.get(`paymentMethodFee.${method}`);
    if (raw != null) {
      const n = Number(String(raw).trim());
      if (Number.isFinite(n) && n >= 0) fees[method] = Math.trunc(n);
    }
  }
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
    defaultExchangeRate: readString(formData, "defaultExchangeRate"),
    minimumTargetMarginBps: readBps(formData, "minimumTargetMarginBps"),
    objectiveTargetMarginBps: readBps(formData, "objectiveTargetMarginBps"),
    defaultCostAllocationMethod: readString(
      formData,
      "defaultCostAllocationMethod",
    ),
    mixedValueAllocationPercent: readString(
      formData,
      "mixedValueAllocationPercent",
    ),
    mixedWeightAllocationPercent: readString(
      formData,
      "mixedWeightAllocationPercent",
    ),
    standardPackagingCostPen: readString(formData, "standardPackagingCostPen"),
    paymentMethodFees: fees,
    enabledSalesChannels: readArray(formData, "enabledSalesChannels"),
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
      const path = issue.path[0];
      if (path === "paymentMethodFees") {
        if (!fieldErrors.paymentMethodFees) {
          fieldErrors.paymentMethodFees = issue.message;
        }
        continue;
      }
      if (typeof path === "string") {
        const key = path as keyof z.infer<typeof BusinessSettingsSchema>;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
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

  const prisma = getPrisma();
  const baseData = {
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
    defaultExchangeRate: data.defaultExchangeRate,
    minimumTargetMarginBps: data.minimumTargetMarginBps,
    objectiveTargetMarginBps: data.objectiveTargetMarginBps,
    defaultCostAllocationMethod: data.defaultCostAllocationMethod,
    mixedValueAllocationPercent: data.mixedValueAllocationPercent,
    mixedWeightAllocationPercent: data.mixedWeightAllocationPercent,
    standardPackagingCostPen: data.standardPackagingCostPen,
    paymentMethodFees: data.paymentMethodFees as Prisma.InputJsonValue,
    enabledSalesChannels: data.enabledSalesChannels,
  } satisfies Prisma.BusinessSettingsUpdateInput &
    Prisma.BusinessSettingsCreateInput;

  await prisma.businessSettings.upsert({
    where: { id: "default" },
    update: baseData,
    create: {
      id: "default",
      ...baseData,
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
