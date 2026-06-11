import { CustomerForm } from "@/components/forms/customer-form";
import { createCustomerAction } from "@/actions/customers";
import type { CustomerActionResult } from "@/lib/customers-types";

export const dynamic = "force-dynamic";

export default function NuevaClientaPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva clienta</h1>
        <p className="text-sm text-muted-foreground">
          Solo el nombre y WhatsApp son obligatorios. El resto es opcional y
          ayuda al despacho.
        </p>
      </div>
      <CustomerForm
        mode="create"
        action={createCustomerAction as (
          prev: CustomerActionResult | undefined,
          formData: FormData,
        ) => Promise<CustomerActionResult>}
        cancelHref="/clientes"
      />
    </div>
  );
}
