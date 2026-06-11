import { QuickSaleForm } from "@/components/forms/quick-sale-form";
import { getOpenLive } from "@/lib/live";

export const dynamic = "force-dynamic";

export default async function VentasPage() {
  const openLive = await getOpenLive();

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Venta rápida</h1>
        <p className="text-sm text-muted-foreground">
          Registra pedidos durante el live. Busca la clienta, agrega productos y
          confirma el adelanto.
        </p>
      </div>
      <QuickSaleForm openLive={openLive} />
    </div>
  );
}
