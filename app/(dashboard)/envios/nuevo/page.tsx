import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CreateShipmentForm } from "@/components/forms/create-shipment-form";
import { Button } from "@/components/ui/button";
import { getCustomerAction } from "@/actions/customers";
import { getOrderDetailAction } from "@/actions/orders";
import { requireRole } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  customerId?: string | string[];
  orderId?: string | string[];
}>;

export default async function NuevoEnvioPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["ADMIN", "DISPATCH"]);
  const sp = await searchParams;
  const customerIdParam = Array.isArray(sp.customerId)
    ? sp.customerId[0]
    : sp.customerId;
  const orderIdParam = Array.isArray(sp.orderId)
    ? sp.orderId[0]
    : sp.orderId;

  const [settings, defaultCustomer, preselectOrder] = await Promise.all([
    getSettings(),
    customerIdParam ? getCustomerAction(customerIdParam) : Promise.resolve(null),
    orderIdParam ? getOrderDetailAction(orderIdParam) : Promise.resolve(null),
  ]);

  const preselect =
    preselectOrder && preselectOrder.status === "PAID" && preselectOrder.shipmentOrder === null
      ? {
          id: preselectOrder.id,
          orderNumber: preselectOrder.orderNumber,
          total: preselectOrder.total.toString(),
        }
      : null;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2"
          render={
            <Link href="/envios">
              <ArrowLeft className="size-4" /> Envíos
            </Link>
          }
        />
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo envío</h1>
        <p className="text-sm text-muted-foreground">
          Selecciona la clienta, agrupa pedidos pagados, define el método y
          registra el envío. La regla de envío gratis se evalúa al crear.
        </p>
      </div>
      <CreateShipmentForm
        enabledShippingMethods={settings.enabledShippingMethods}
        freeShippingEnabled={settings.freeShippingEnabled}
        freeShippingThreshold={settings.freeShippingThreshold.toString()}
        defaultCustomer={defaultCustomer as never}
        preselectOrder={preselect as never}
      />
    </div>
  );
}
