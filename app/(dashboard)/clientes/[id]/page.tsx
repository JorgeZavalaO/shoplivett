import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CustomerSummary } from "@/components/dashboard/customer-summary";
import { CustomerStatusBadge } from "@/components/dashboard/customer-status-badge";
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
import { DeactivateCustomerButton } from "@/components/forms/deactivate-customer-button";
import { centsToDecimalString, sumCents } from "@/lib/money";

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
  const totalAvailableCents = sumCents(
    credits
      .filter((c) => c.status === "AVAILABLE" || c.status === "PARTIALLY_USED")
      .map((c) => c.availableAmount),
  );
  const totalAvailable = centsToDecimalString(totalAvailableCents);
  const hasCredit = totalAvailableCents > 0;

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
    <div className="flex flex-1 flex-col gap-6 bg-muted/20 p-4 md:p-6">
      <div className="flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit -ml-2"
          render={<Link href="/clientes"><ArrowLeft className="size-4" /> Clientes</Link>}
        />
        <Card className="border-border/70 shadow-sm">
          <CardContent className="flex flex-col gap-4 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                <UserRound className="size-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-2xl font-semibold tracking-tight">{summary.name}</h1>
                  <CustomerStatusBadge status={summary.status} />
                  {!summary.isActive ? (
                    <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Inactiva
                    </span>
                  ) : null}
                </div>
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline"
                >
                  <Phone className="size-3.5" /> {formatWhatsAppDisplay(summary.whatsapp)}
                </a>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    {summary.district || "Sin distrito"}
                  </span>
                  {summary.channel ? (
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="size-3.5" />
                      {summary.channel}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <WhatsAppQuickButton
                customer={{ name: summary.name, whatsapp: summary.whatsapp }}
                label="Abrir chat"
              />
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
          </CardContent>
        </Card>
      </div>

      <CustomerSummary
        customer={summary}
        debt={summary.debt}
        credit={summary.credit}
      />

      <Card className="border-border/70 shadow-sm">
        <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-base font-semibold">Estado comercial</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Una clienta bloqueada no puede registrar nuevas ventas. El cambio se refleja de inmediato en venta rápida.
            </p>
          </div>
          <form action={changeStatus} className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="status" className="text-xs font-medium text-muted-foreground">Estado</label>
              <select
                id="status"
                name="status"
                defaultValue={summary.status}
                className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
              >
                <option value="ACTIVE">Activa</option>
                <option value="FREQUENT">Frecuente</option>
                <option value="RISKY">Riesgosa</option>
                <option value="BLOCKED">Bloqueada</option>
              </select>
            </div>
            <Button type="submit" variant="secondary">Actualizar estado</Button>
          </form>
        </CardContent>
      </Card>

      <CustomerCreditsHistory
        credits={credits}
        customer={{ id, name: summary.name, whatsapp: summary.whatsapp }}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <CustomerShipmentsHistory shipments={shipments} />
        <div className="flex flex-col gap-4">
          <Card className="border-border/70 shadow-sm">
            <CardContent className="flex flex-col gap-3 py-5">
              <div>
                <h2 className="text-base font-semibold">Mensajes para WhatsApp</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Selecciona una plantilla, previsualízala y envíala desde WhatsApp.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
                          totalAmount: totalAvailable,
                          availableAmount: totalAvailable,
                        }
                      : undefined
                  }
                  defaultTemplate={hasCredit ? "CREDIT_AVAILABLE" : "BALANCE_REMINDER"}
                />
                {hasCredit ? (
                  <Button
                    size="sm"
                    variant="outline"
                    render={
                      <a
                        href={`https://wa.me/${summary.whatsapp.replace(/[^\d]/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageCircle className="size-4" /> Abrir chat
                      </a>
                    }
                  />
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <CustomerOrdersHistory customerId={id} initialData={ordersData} />
        <CustomerPaymentsHistory customerId={id} initialData={paymentsData} />
      </div>
    </div>
  );
}
