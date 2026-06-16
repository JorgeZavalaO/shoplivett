import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CreatePaymentForm } from "@/components/forms/create-payment-form";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";


export default async function NuevoPagoPage() {
  await requireRole(["ADMIN", "SELLER"]);
  const settings = await getSettings();

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2"
          render={
            <Link href="/pagos">
              <ArrowLeft className="size-4" /> Pagos
            </Link>
          }
        />
        <h1 className="text-2xl font-semibold tracking-tight">Registrar pago</h1>
        <p className="text-sm text-muted-foreground">
          Crea un pago manual y aplícalo a uno o varios pedidos de la misma
          clienta. Quedará en estado <strong>Pendiente</strong> hasta que un rol
          autorizado lo valide.
        </p>
      </div>
      <CreatePaymentForm enabledMethods={settings.enabledPaymentMethods} />
    </div>
  );
}
