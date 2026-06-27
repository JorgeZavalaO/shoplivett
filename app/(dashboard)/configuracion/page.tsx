import type { Metadata } from "next";
import { Sparkles } from "lucide-react";

import { requireRole } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { coercePaymentMethodFees } from "@/lib/settings-defaults";
import { SettingsForm } from "@/components/forms/settings-form";

export const metadata: Metadata = { title: "Configuración" };


function formatDecimal(value: unknown): string {
  const n = Number(value?.toString?.() ?? value);
  if (Number.isNaN(n)) return "0.00";
  return n.toFixed(2);
}

function formatExchangeRate(value: unknown): string {
  const n = Number(value?.toString?.() ?? value);
  if (Number.isNaN(n) || n <= 0) return "3.7500";
  return n.toFixed(4);
}

export default async function ConfiguracionPage() {
  await requireRole("ADMIN");
  const settings = await getSettings();

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Reglas operativas y financieras del negocio. Cualquier cambio se
          aplica de forma inmediata a ventas, pagos, envíos y reportes.
        </p>
      </div>

      <SettingsForm
        initial={{
          reservationDays: settings.reservationDays,
          minimumAdvance: formatDecimal(settings.minimumAdvance),
          currency: settings.currency,
          freeShippingEnabled: settings.freeShippingEnabled,
          freeShippingThreshold: formatDecimal(settings.freeShippingThreshold),
          productCodePrefix: settings.productCodePrefix,
          allowOverpaymentCredit: settings.allowOverpaymentCredit,
          allowRefund: settings.allowRefund,
          enabledPaymentMethods: settings.enabledPaymentMethods,
          enabledShippingMethods: settings.enabledShippingMethods,
          paymentValidatorRoles: settings.paymentValidatorRoles,
          defaultExchangeRate: formatExchangeRate(settings.defaultExchangeRate),
          minimumTargetMarginBps: settings.minimumTargetMarginBps,
          objectiveTargetMarginBps: settings.objectiveTargetMarginBps,
          defaultCostAllocationMethod: settings.defaultCostAllocationMethod,
          mixedValueAllocationPercent: settings.mixedValueAllocationPercent,
          mixedWeightAllocationPercent: settings.mixedWeightAllocationPercent,
          standardPackagingCostPen: formatDecimal(
            settings.standardPackagingCostPen,
          ),
          paymentMethodFees: coercePaymentMethodFees(settings.paymentMethodFees),
          enabledSalesChannels: settings.enabledSalesChannels,
        }}
      />
    </div>
  );
}
