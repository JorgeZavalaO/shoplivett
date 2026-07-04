import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CustomerSummary } from "@/components/dashboard/customer-summary";
import { CustomerCreditsHistory } from "@/components/dashboard/customer-credits-history";
import { CustomerShipmentsHistory } from "@/components/dashboard/customer-shipments-history";
import { CustomerOrdersHistory } from "@/components/dashboard/customer-orders-history";
import { CustomerPaymentsHistory } from "@/components/dashboard/customer-payments-history";
import { getCustomerSummary } from "@/lib/customer-helpers";
import { getCustomerCreditsAction } from "@/actions/credits";
import { listCustomerOrdersAction } from "@/actions/orders";
import { listCustomerPaymentsAction } from "@/actions/payments";
import { requireRole } from "@/lib/permissions";
import { listCustomerShipmentsAction } from "@/actions/shipments";
import { setCustomerStatusAction } from "@/actions/customers";
import { formatWhatsAppDisplay } from "@/lib/phone";
import {
  WhatsAppActions,
  WhatsAppQuickButton,
} from "@/components/whatsapp/whatsapp-actions";
import { buildWhatsappLink, buildWhatsappMessage } from "@/lib/whatsapp";
import { DeactivateCustomerButton } from "@/components/forms/deactivate-customer-button";


type Params = Promise<{ id: string }>;

export default async function ClienteDetallePage({ params }: { params: Params }) {
  await requireRole(["ADMIN", "SELLER"]);
  const { id } = await params;
  const summary = await getCustomerSummary(id);
  if (!summary) notFound();

  const [credits, shipments, ordersData, paymentsData] = await Promise.all([
    getCustomerCreditsAction(id),
    listCustomerShipmentsAction(id),
    listCustomerOrdersAction(id, { page: 1, perPage: 10 }),
    listCustomerPaymentsAction(id, { page: 1, perPage: 10 }),
  ]);

  const whatsappLink = `https://wa.me/${summary.whatsapp.replace(/[^\d]/g, "")}`;
  const totalAvailable = credits
    .filter((c) => c.status === "AVAILABLE" || c.status === "PARTIALLY_USED")
    .reduce((acc, c) => acc + Number(c.availableAmount), 0);
  const hasCredit = totalAvailable > 0;
  const creditMessageLink = hasCredit
    ? buildWhatsappLink(
        summary.whatsapp,
        buildWhatsappMessage({
          key: "CREDIT_AVAILABLE",
          customer: { name: summary.name, whatsapp: summary.whatsapp },
          credit: {
            totalAmount: totalAvailable.toFixed(2),
            availableAmount: totalAvailable.toFixed(2),
          },
        }),
      )
    : null;

  async function changeStatus(formData: FormData) {
    "use server";
    const status = String(formData.get("status") ?? "ACTIVE") as
      | "ACTIVE"
      | "FREQUENT"
      | "RISKY"
      | "BLOCKED";
    await setCustomerStatusAction(id, status);
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2"
            render={<Link href="/clientes"><ArrowLeft className="size-4" /> Clientes</Link>}
          />
          <h1 className="text-2xl font-semibold tracking-tight">
            {summary.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {formatWhatsAppDisplay(summary.whatsapp)}
            </a>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <WhatsAppQuickButton
              customer={{ name: summary.name, whatsapp: summary.whatsapp }}
              label="Abrir chat"
            />
            {creditMessageLink ? (
              <Button
                size="sm"
                variant="outline"
                render={
                  <a
                    href={creditMessageLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle className="size-4" /> Avisar crédito
                  </a>
                }
              />
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            render={<Link href={`/clientes/${summary.id}/editar`}><Pencil className="size-4" /> Editar</Link>}
          />
          {summary.isActive ? (
            <DeactivateCustomerButton
              customerId={summary.id}
              customerName={summary.name}
            />
          ) : null}
        </div>
      </div>

      <CustomerSummary
        customer={summary}
        debt={summary.debt}
        credit={summary.credit}
      />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-base font-semibold">Cambiar estado</h2>
          <p className="text-xs text-muted-foreground">
            Una clienta con estado &quot;Bloqueada&quot; no puede registrar
            nuevas ventas: el servidor rechaza la venta rápida de forma
            explícita.
          </p>
        </div>
        <form action={changeStatus} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="status" className="text-sm font-medium">
              Estado
            </label>
            <select
              id="status"
              name="status"
              defaultValue={summary.status}
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
            >
              <option value="ACTIVE">Activa</option>
              <option value="FREQUENT">Frecuente</option>
              <option value="RISKY">Riesgosa</option>
              <option value="BLOCKED">Bloqueada</option>
            </select>
          </div>
          <Button type="submit" variant="secondary">
            Actualizar estado
          </Button>
        </form>
      </div>

      <CustomerCreditsHistory
        credits={credits}
        customer={{ id, name: summary.name, whatsapp: summary.whatsapp }}
      />

      <CustomerShipmentsHistory shipments={shipments} />

      <div className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Mensajes para WhatsApp</h2>
        <p className="text-xs text-muted-foreground">
          Plantillas para enviar a {summary.name}. No se envía automáticamente.
        </p>
      </div>
      <WhatsAppActions
        customer={{ name: summary.name, whatsapp: summary.whatsapp }}
        context={{
          hasOrder: false,
          hasPayment: false,
          hasShipment: false,
          hasCredit,
        }}
        credit={
          hasCredit
            ? {
                totalAmount: totalAvailable.toFixed(2),
                availableAmount: totalAvailable.toFixed(2),
              }
            : undefined
        }
        defaultTemplate={hasCredit ? "CREDIT_AVAILABLE" : "BALANCE_REMINDER"}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <CustomerOrdersHistory customerId={id} initialData={ordersData} />
        <CustomerPaymentsHistory customerId={id} initialData={paymentsData} />
      </div>
    </div>
  );
}
