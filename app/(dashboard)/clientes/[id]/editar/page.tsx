import { notFound, redirect } from "next/navigation";

import { CustomerForm } from "@/components/forms/customer-form";
import { updateCustomerAction } from "@/actions/customers";
import type { CustomerActionResult } from "@/lib/customers-types";
import { getCustomerSummary } from "@/lib/customer-helpers";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function EditarClientaPage({ params }: { params: Params }) {
  const { id } = await params;
  const summary = await getCustomerSummary(id);
  if (!summary) notFound();
  if (!summary.isActive) redirect(`/clientes/${id}`);

  const boundUpdate: (
    prev: CustomerActionResult | undefined,
    formData: FormData,
  ) => Promise<CustomerActionResult> = (prev, formData) =>
    updateCustomerAction(id, prev, formData);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Editar clienta</h1>
        <p className="text-sm text-muted-foreground">
          Actualiza los datos de {summary.name}.
        </p>
      </div>
      <CustomerForm
        mode="edit"
        action={boundUpdate}
        cancelHref={`/clientes/${id}`}
        initial={{
          name: summary.name,
          whatsapp: summary.whatsapp,
          document: summary.document,
          address: summary.address,
          district: summary.district,
          reference: summary.reference,
          channel: summary.channel,
          notes: summary.notes,
          status: summary.status,
        }}
      />
    </div>
  );
}
