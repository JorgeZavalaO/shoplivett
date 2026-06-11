// Acceso centralizado a BusinessSettings.
import type {
  BusinessSettings as PrismaBusinessSettings,
  PaymentMethod,
  Role,
  ShippingMethod,
} from "@prisma/client";

import { getPrisma } from "@/lib/prisma";
import { DEFAULT_BUSINESS_SETTINGS } from "@/lib/settings-defaults";

const SETTINGS_ID = "default";

type SettingsCache = {
  value: PrismaBusinessSettings;
};

const globalForSettings = globalThis as unknown as {
  settingsCache: SettingsCache | undefined;
};

function normalize(row: PrismaBusinessSettings): PrismaBusinessSettings {
  return row;
}

export async function getSettings(): Promise<PrismaBusinessSettings> {
  if (globalForSettings.settingsCache) {
    return globalForSettings.settingsCache.value;
  }

  const prisma = getPrisma();
  const existing = await prisma.businessSettings.findUnique({
    where: { id: SETTINGS_ID },
  });

  const row =
    existing ??
    (await prisma.businessSettings.create({
      data: {
        id: SETTINGS_ID,
        reservationDays: DEFAULT_BUSINESS_SETTINGS.reservationDays,
        minimumAdvance: DEFAULT_BUSINESS_SETTINGS.minimumAdvance,
        currency: DEFAULT_BUSINESS_SETTINGS.currency,
        freeShippingEnabled: DEFAULT_BUSINESS_SETTINGS.freeShippingEnabled,
        freeShippingThreshold: DEFAULT_BUSINESS_SETTINGS.freeShippingThreshold,
        productCodePrefix: DEFAULT_BUSINESS_SETTINGS.productCodePrefix,
        allowOverpaymentCredit: DEFAULT_BUSINESS_SETTINGS.allowOverpaymentCredit,
        allowRefund: DEFAULT_BUSINESS_SETTINGS.allowRefund,
        enabledPaymentMethods: DEFAULT_BUSINESS_SETTINGS.enabledPaymentMethods,
        enabledShippingMethods: DEFAULT_BUSINESS_SETTINGS.enabledShippingMethods,
        paymentValidatorRoles: DEFAULT_BUSINESS_SETTINGS.paymentValidatorRoles,
      },
    }));

  const normalized = normalize(row);
  globalForSettings.settingsCache = { value: normalized };
  return normalized;
}

export async function requireSettings(): Promise<PrismaBusinessSettings> {
  return getSettings();
}

export function invalidateSettingsCache(): void {
  globalForSettings.settingsCache = undefined;
}

// Helpers consumibles desde otros sprints.

export async function getReservationDays(): Promise<number> {
  return (await getSettings()).reservationDays;
}

export async function getMinimumAdvance(): Promise<string> {
  return (await getSettings()).minimumAdvance.toString();
}

export async function getEnabledPaymentMethods(): Promise<PaymentMethod[]> {
  return (await getSettings()).enabledPaymentMethods;
}

export async function getEnabledShippingMethods(): Promise<ShippingMethod[]> {
  return (await getSettings()).enabledShippingMethods;
}

export async function getPaymentValidatorRoles(): Promise<Role[]> {
  return (await getSettings()).paymentValidatorRoles;
}

export async function isPaymentValidator(role: Role): Promise<boolean> {
  const roles = await getPaymentValidatorRoles();
  return roles.includes(role);
}

export async function getFreeShippingRule(): Promise<{
  enabled: boolean;
  threshold: string;
}> {
  const s = await getSettings();
  return {
    enabled: s.freeShippingEnabled,
    threshold: s.freeShippingThreshold.toString(),
  };
}
