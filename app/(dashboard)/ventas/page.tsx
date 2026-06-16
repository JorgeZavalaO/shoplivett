import type { Metadata } from "next";

import { QuickSaleForm } from "@/components/forms/quick-sale-form";
import { getOpenLive } from "@/lib/live";
import { getSettings } from "@/lib/settings";
import { requireRole } from "@/lib/permissions";

export const metadata: Metadata = { title: "Venta rápida" };

export default async function VentasPage() {
  await requireRole(["ADMIN", "SELLER"]);
  const [openLive, settings] = await Promise.all([getOpenLive(), getSettings()]);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Venta rápida</h1>
        <p className="text-sm text-muted-foreground">
          Registra pedidos durante el live. Busca la clienta, agrega productos y
          confirma el adelanto.
        </p>
      </div>
      <QuickSaleForm
        openLive={openLive}
        enabledPaymentMethods={settings.enabledPaymentMethods}
      />
    </div>
  );
}
