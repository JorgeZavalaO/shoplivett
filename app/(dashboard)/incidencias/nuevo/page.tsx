import type { Metadata } from "next";

import { IncidentForm } from "@/components/forms/incident-form";
import { requireRole } from "@/lib/permissions";

export const metadata: Metadata = { title: "Nueva incidencia" };

type SearchParams = Promise<{
  orderId?: string | string[];
  variantId?: string | string[];
  customerId?: string | string[];
}>;

function first<T = string>(v: T | T[] | undefined): T | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function NuevaIncidenciaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["ADMIN"]);
  const sp = await searchParams;
  const prefill = {
    orderId: first(sp.orderId),
    variantId: first(sp.variantId),
    customerId: first(sp.customerId),
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva incidencia</h1>
        <p className="text-sm text-muted-foreground">
          Registra una devolucion, dano, perdida, reclamo o cambio. Las
          integraciones con stock y creditos se aplican en la misma transaccion.
        </p>
      </div>
      <IncidentForm cancelHref="/incidencias" prefill={prefill} />
    </div>
  );
}
