// Acceso centralizado a BusinessSettings.
//
// En Vercel multi-instancia / serverless, no se puede confiar en una caché
// en proceso (globalThis). En su lugar se usa la cache de Next.js con
// `unstable_cache` y se invalida explícitamente con `revalidateTag` desde
// `actions/settings.ts` cuando el admin guarda cambios.

import { unstable_cache, revalidateTag, updateTag } from "next/cache";
import type {
  BusinessSettings as PrismaBusinessSettings,
  PaymentMethod,
  Role,
  ShippingMethod,
} from "@prisma/client";

import { getPrisma } from "@/lib/prisma";
import { DEFAULT_BUSINESS_SETTINGS } from "@/lib/settings-defaults";

export const SETTINGS_CACHE_TAG = "settings";
const SETTINGS_ID = "default";

async function loadSettings(): Promise<PrismaBusinessSettings> {
  const prisma = getPrisma();
  // `upsert` evita la carrera que existía entre `findUnique` + `create` cuando
  // dos requests concurrentes veían el singleton ausente y trataban de crearlo.
  return prisma.businessSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
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
    update: {},
  });
}

/**
 * Settings con caché por tag. La caché es de Next.js, no de proceso, así que
 * es coherente entre instancias serverless.
 */
const getCachedSettings = unstable_cache(loadSettings, [SETTINGS_CACHE_TAG], {
  tags: [SETTINGS_CACHE_TAG],
});

export async function getSettings(): Promise<PrismaBusinessSettings> {
  return getCachedSettings();
}

export async function requireSettings(): Promise<PrismaBusinessSettings> {
  return getCachedSettings();
}

/**
 * Invalida la caché de settings. Pensado para llamarse dentro de Server
 * Actions: usa `updateTag` para tener semántica read-your-own-writes.
 */
export function invalidateSettingsCache(): void {
  try {
    updateTag(SETTINGS_CACHE_TAG);
  } catch {
    revalidateTag(SETTINGS_CACHE_TAG, "max");
  }
}

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
