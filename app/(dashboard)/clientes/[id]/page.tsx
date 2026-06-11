import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, UserX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CustomerSummary } from "@/components/dashboard/customer-summary";
import { getCustomerSummary } from "@/lib/customer-helpers";
import {
  deactivateCustomerAction,
  setCustomerStatusAction,
} from "@/actions/customers";
import { formatWhatsAppDisplay } from "@/lib/phone";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

const HISTORY_TABS = [
  { label: "Pedidos", sprint: "Sprint 7" },
  { label: "Pagos", sprint: "Sprint 8" },
  { label: "Créditos", sprint: "Sprint 9" },
  { label: "Envíos", sprint: "Sprint 10" },
];

export default async function ClienteDetallePage({ params }: { params: Params }) {
  const { id } = await params;
  const summary = await getCustomerSummary(id);
  if (!summary) notFound();

  const whatsappLink = `https://wa.me/${summary.whatsapp.replace(/[^\d]/g, "")}`;

  async function changeStatus(formData: FormData) {
    "use server";
    const status = String(formData.get("status") ?? "ACTIVE") as
      | "ACTIVE"
      | "FREQUENT"
      | "RISKY"
      | "BLOCKED";
    await setCustomerStatusAction(id, status);
  }

  async function deactivate() {
    "use server";
    await deactivateCustomerAction(id);
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
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            render={<Link href={`/clientes/${summary.id}/editar`}><Pencil className="size-4" /> Editar</Link>}
          />
          {summary.isActive ? (
            <form action={deactivate}>
              <Button
                type="submit"
                variant="outline"
                className="text-destructive"
              >
                <UserX className="size-4" /> Dar de baja
              </Button>
            </form>
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
            Bloqueo es informativo: no impide ventas en Sprint 3. Se endurecerá
            al entrar al flujo de pedidos.
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

      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Historial</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {HISTORY_TABS.map((tab) => (
            <div
              key={tab.label}
              className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm"
            >
              <p className="font-medium">{tab.label}</p>
              <p className="text-xs text-muted-foreground">
                Disponible en {tab.sprint}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
