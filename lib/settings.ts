// Acceso centralizado a BusinessSettings.
//
// En Vercel multi-instancia / serverless, no se puede confiar en una caché
// en proceso (globalThis). En su lugar se usa la cache de Next.js con
// `unstable_cache` y se invalida explícitamente con `revalidateTag` desde
// `actions/settings.ts` cuando el admin guarda cambios.

import { Prisma } from "@prisma/client";
import { unstable_cache, revalidateTag, updateTag } from "next/cache";
import type {
  BusinessSettings as PrismaBusinessSettings,
  CostAllocationMethod,
  PaymentMethod,
  Role,
  SalesChannel,
  ShippingMethod,
} from "@prisma/client";

import { getPrisma } from "@/lib/prisma";
import {
  DEFAULT_BUSINESS_SETTINGS,
  coercePaymentMethodFees,
  type PaymentMethodFees,
} from "@/lib/settings-defaults";

export const SETTINGS_CACHE_TAG = "settings";
const SETTINGS_ID = "default";

async function loadSettings(): Promise<PrismaBusinessSettings> {
  const prisma = getPrisma();
  const existing = await prisma.businessSettings.findUnique({
    where: { id: SETTINGS_ID },
  });
  if (existing) return existing;
  try {
    return await prisma.businessSettings.create({
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
        defaultExchangeRate: DEFAULT_BUSINESS_SETTINGS.defaultExchangeRate,
        minimumTargetMarginBps: DEFAULT_BUSINESS_SETTINGS.minimumTargetMarginBps,
        objectiveTargetMarginBps: DEFAULT_BUSINESS_SETTINGS.objectiveTargetMarginBps,
        defaultCostAllocationMethod:
          DEFAULT_BUSINESS_SETTINGS.defaultCostAllocationMethod,
        mixedValueAllocationPercent:
          DEFAULT_BUSINESS_SETTINGS.mixedValueAllocationPercent,
        mixedWeightAllocationPercent:
          DEFAULT_BUSINESS_SETTINGS.mixedWeightAllocationPercent,
        standardPackagingCostPen: DEFAULT_BUSINESS_SETTINGS.standardPackagingCostPen,
        paymentMethodFees: DEFAULT_BUSINESS_SETTINGS.paymentMethodFees,
        enabledSalesChannels: DEFAULT_BUSINESS_SETTINGS.enabledSalesChannels,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return (await prisma.businessSettings.findUnique({
        where: { id: SETTINGS_ID },
      }))!;
    }
    throw error;
  }
}

/**
 * Settings con caché por tag. La caché es de Next.js, no de proceso, así que
 * es coherente entre instancias serverless.
 */
const getCachedSettings = unstable_cache(loadSettings, [SETTINGS_CACHE_TAG], {
  tags: [SETTINGS_CACHE_TAG],
});

function isMissingIncrementalCache(error: unknown): boolean {
  return error instanceof Error && error.message.includes("incrementalCache missing");
}

async function getSettingsWithRuntimeFallback(): Promise<PrismaBusinessSettings> {
  try {
    return await getCachedSettings();
  } catch (error) {
    // Scripts y pruebas de dominio corren fuera del runtime de Next, donde
    // unstable_cache no tiene incrementalCache disponible.
    if (isMissingIncrementalCache(error)) return loadSettings();
    throw error;
  }
}

export async function getSettings(): Promise<PrismaBusinessSettings> {
  return getSettingsWithRuntimeFallback();
}

export async function requireSettings(): Promise<PrismaBusinessSettings> {
  return getSettingsWithRuntimeFallback();
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

// =====================================================================
// Helpers financieros (Sprint 18)
// =====================================================================

export async function getDefaultExchangeRate(): Promise<number> {
  const s = await getSettings();
  return Number(s.defaultExchangeRate.toString());
}

export async function getTargetMargins(): Promise<{
  minimumBps: number;
  objectiveBps: number;
}> {
  const s = await getSettings();
  return {
    minimumBps: s.minimumTargetMarginBps,
    objectiveBps: s.objectiveTargetMarginBps,
  };
}

export async function getDefaultCostAllocationMethod(): Promise<CostAllocationMethod> {
  return (await getSettings()).defaultCostAllocationMethod;
}

export async function getMixedAllocationPercents(): Promise<{
  value: number;
  weight: number;
}> {
  const s = await getSettings();
  return {
    value: s.mixedValueAllocationPercent,
    weight: s.mixedWeightAllocationPercent,
  };
}

export async function getStandardPackagingCost(): Promise<string> {
  return (await getSettings()).standardPackagingCostPen.toString();
}

export async function getPaymentMethodFees(): Promise<PaymentMethodFees> {
  return coercePaymentMethodFees((await getSettings()).paymentMethodFees);
}

export async function getEnabledSalesChannels(): Promise<SalesChannel[]> {
  return (await getSettings()).enabledSalesChannels;
}
