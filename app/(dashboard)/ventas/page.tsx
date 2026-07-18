import type { Metadata } from "next";

import { QuickSaleForm } from "@/components/forms/quick-sale-form";
import { ReceiptText, Sparkles } from "lucide-react";
import { getSaleCatalogAction } from "@/actions/sales";
import { getOpenLive } from "@/lib/live";
import { getSettings } from "@/lib/settings";
import { requireRole } from "@/lib/permissions";
import { getEnabledSalesChannels } from "@/lib/settings";
import { SALES_CHANNEL_LABELS } from "@/lib/settings-defaults";

export const metadata: Metadata = { title: "Venta rápida" };

// El stock y los precios cambian con cada pedido, así que la página debe
// renderizarse siempre de forma fresca: nada de caché de página completa.
export const dynamic = "force-dynamic";

export default async function VentasPage() {
  await requireRole(["ADMIN", "SELLER"]);
  const [openLive, settings, enabledChannels, catalogVariants] = await Promise.all([
    getOpenLive(),
    getSettings(),
    getEnabledSalesChannels(),
    getSaleCatalogAction(),
  ]);

  const salesChannelOptions = enabledChannels.map((value) => ({
    value,
    label: SALES_CHANNEL_LABELS[value],
  }));

  return (
    <div className="flex flex-1 flex-col gap-5 bg-muted/20 p-4 md:p-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-primary p-2.5 text-primary-foreground shadow-sm">
            <ReceiptText className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">Venta rápida</h1>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                POS
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Registra una venta en pocos pasos: clienta, productos y cobro.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Sparkles className="size-3.5 text-amber-500" />
          Caja lista para operar
        </div>
      </div>
      <QuickSaleForm
        openLive={openLive}
        enabledPaymentMethods={settings.enabledPaymentMethods}
        salesChannelOptions={salesChannelOptions}
        catalogVariants={catalogVariants}
      />
    </div>
  );
}
