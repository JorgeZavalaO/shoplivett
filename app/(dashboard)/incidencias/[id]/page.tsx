import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Package, Receipt, User } from "lucide-react";
import type {
  IncidentReturnDecision,
  IncidentStatus,
  IncidentType,
} from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IncidentStatusBadge } from "@/components/tables/incident-status-badge";
import { ResolveIncidentButton } from "@/components/forms/resolve-incident-button";
import { CancelIncidentButton } from "@/components/forms/cancel-incident-button";
import { getIncidentDetailAction } from "@/actions/incidents";
import { requireRole } from "@/lib/permissions";
import {
  INCIDENT_DECISION_LABELS,
  INCIDENT_TYPE_LABELS,
} from "@/lib/incidents-shared";

type Params = Promise<{ id: string }>;

type IncidentDetail = {
  id: string;
  incidentDate: Date;
  type: IncidentType;
  status: IncidentStatus;
  decision: IncidentReturnDecision;
  quantity: number;
  description: string;
  recoveredAmount: { toString(): string };
  lostAmount: { toString(): string };
  restockQuantity: number;
  creditId: string | null;
  notes: string | null;
  resolutionNotes: string | null;
  cancelledReason: string | null;
  cancelledAt: Date | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    total: string | { toString(): string };
    customer: { id: string; name: string; whatsapp: string } | null;
  } | null;
  orderItem: {
    id: string;
    quantity: number;
    lineTotal: string | { toString(): string };
    totalCostPen: string | { toString(): string };
    variant: {
      id: string;
      code: string;
      color: string | null;
      product: { id: string; name: string };
    };
  } | null;
  variant: {
    id: string;
    code: string;
    color: string | null;
    price: string | { toString(): string };
    cost: string | { toString(): string } | null;
    stock: number;
    soldStock: number;
    product: { id: string; name: string };
  } | null;
  customer: { id: string; name: string; whatsapp: string } | null;
  credit: {
    id: string;
    amount: string | { toString(): string };
    availableAmount: string | { toString(): string };
    status: string;
    origin: string;
  } | null;
  createdBy: { id: string; name: string; email: string } | null;
  resolvedBy: { id: string; name: string; email: string } | null;
};

const DATE_FORMATTER = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "long",
});

const DATETIME_FORMATTER = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatPen(value: string | { toString(): string } | number): string {
  const raw =
    typeof value === "object" && value !== null
      ? value.toString()
      : String(value);
  return `S/ ${Number(raw).toFixed(2)}`;
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  const incident = (await getIncidentDetailAction(id)) as IncidentDetail | null;
  if (!incident) return { title: "Incidencia no encontrada" };
  return { title: `Incidencia · ${incident.description.slice(0, 60)}` };
}

export default async function IncidenciaDetailPage({
  params,
}: {
  params: Params;
}) {
  await requireRole(["ADMIN"]);
  const { id } = await params;
  const incident = (await getIncidentDetailAction(id)) as IncidentDetail | null;
  if (!incident) notFound();

  const lost = formatPen(incident.lostAmount);
  const recovered = formatPen(incident.recoveredAmount);
  const isCancelled = incident.status === "CANCELLED";
  const isResolved = incident.status === "RESOLVED";

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          render={
            <Link href="/incidencias">
              <ArrowLeft className="size-4" /> Volver
            </Link>
          }
        />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {incident.description}
            </h1>
            <IncidentStatusBadge status={incident.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {INCIDENT_TYPE_LABELS[incident.type]} · {INCIDENT_DECISION_LABELS[incident.decision]}
          </p>
        </div>
        {isCancelled ? null : (
          <div className="flex items-center gap-2">
            <CancelIncidentButton incidentId={incident.id} />
            {!isResolved ? (
              <ResolveIncidentButton incidentId={incident.id} />
            ) : null}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Fecha</p>
          <p className="mt-1 text-base font-medium">
            {DATE_FORMATTER.format(new Date(incident.incidentDate))}
          </p>
          <p className="text-xs text-muted-foreground">
            Cantidad: {incident.quantity}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Monto perdido</p>
          <p className="mt-1 text-base font-mono font-semibold text-destructive">
            {lost}
          </p>
          <p className="text-xs text-muted-foreground">
            Restock: {incident.restockQuantity} uds
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Monto recuperado</p>
          <p className="mt-1 text-base font-mono font-semibold text-emerald-600">
            {recovered}
          </p>
          <p className="text-xs text-muted-foreground">
            {incident.creditId ? "Emitido como credito" : "Sin credito"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Decision</p>
          <p className="mt-1 text-base font-medium">
            {INCIDENT_DECISION_LABELS[incident.decision]}
          </p>
          <p className="text-xs text-muted-foreground">
            Tipo: {INCIDENT_TYPE_LABELS[incident.type]}
          </p>
        </div>
      </div>

      {isResolved && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
          <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
            Incidencia resuelta
          </p>
          <p className="text-xs text-emerald-800 dark:text-emerald-300">
            {incident.resolvedAt
              ? `Resuelta el ${DATETIME_FORMATTER.format(new Date(incident.resolvedAt))} por ${incident.resolvedBy?.name ?? "sistema"}.`
              : "Resuelta."}
          </p>
          {incident.resolutionNotes ? (
            <p className="mt-1 text-xs text-emerald-900 dark:text-emerald-200">
              {incident.resolutionNotes}
            </p>
          ) : null}
        </div>
      )}

      {isCancelled && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            Incidencia cancelada
          </p>
          <p className="text-xs text-amber-800 dark:text-amber-300">
            {incident.cancelledAt
              ? `Cancelada el ${DATETIME_FORMATTER.format(new Date(incident.cancelledAt))}.`
              : "Cancelada."}
          </p>
          {incident.cancelledReason ? (
            <p className="mt-1 text-xs text-amber-900 dark:text-amber-200">
              Motivo: {incident.cancelledReason}
            </p>
          ) : null}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Receipt className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Pedido</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {incident.order ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Numero</span>
                  <Link
                    href={`/pedidos/${incident.order.id}`}
                    className="font-mono font-medium hover:underline"
                  >
                    {incident.order.orderNumber}
                  </Link>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Estado</span>
                  <span className="text-xs">{incident.order.status}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-mono">
                    {formatPen(incident.order.total)}
                  </span>
                </div>
                {incident.orderItem ? (
                  <div className="mt-2 rounded-md border border-border bg-muted/30 p-2 text-xs">
                    <p>
                      Linea: {incident.orderItem.variant.product.name}
                      {incident.orderItem.variant.color
                        ? ` (${incident.orderItem.variant.color})`
                        : ""}
                    </p>
                    <p className="text-muted-foreground">
                      {incident.orderItem.quantity} uds · S/{" "}
                      {Number(
                        typeof incident.orderItem.lineTotal === "string"
                          ? incident.orderItem.lineTotal
                          : incident.orderItem.lineTotal.toString(),
                      ).toFixed(2)}
                    </p>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Sin pedido asociado.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Package className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Producto</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {incident.variant ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">SKU</span>
                  <span className="font-mono text-xs">
                    {incident.variant.code}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Producto</span>
                  <Link
                    href={`/productos/${incident.variant.product.id}`}
                    className="hover:underline"
                  >
                    {incident.variant.product.name}
                  </Link>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Stock actual</span>
                  <span className="text-xs">
                    {incident.variant.stock} / vendido {incident.variant.soldStock}
                  </span>
                </div>
                {incident.variant.color ? (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Color</span>
                    <span className="text-xs">{incident.variant.color}</span>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Sin producto asociado.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Clienta</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {incident.customer ? (
              <>
                <Link
                  href={`/clientes/${incident.customer.id}`}
                  className="font-medium hover:underline"
                >
                  {incident.customer.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {incident.customer.whatsapp}
                </p>
                {incident.credit ? (
                  <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">
                    Credito emitido: {formatPen(incident.credit.amount)} ·
                    disponible {formatPen(incident.credit.availableAmount)} ·
                    estado {incident.credit.status}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Sin clienta asociada.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Auditoria</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Creada</span>
              <span className="text-xs">
                {DATETIME_FORMATTER.format(new Date(incident.createdAt))}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Por</span>
              <span className="text-xs">
                {incident.createdBy?.name ?? "Sistema"}
              </span>
            </div>
            {incident.resolvedAt ? (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Resuelta</span>
                <span className="text-xs">
                  {DATETIME_FORMATTER.format(new Date(incident.resolvedAt))}
                </span>
              </div>
            ) : null}
            {incident.resolvedBy ? (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Por</span>
                <span className="text-xs">{incident.resolvedBy.name}</span>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {incident.notes ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Notas</p>
          <p className="mt-1 text-sm whitespace-pre-wrap">{incident.notes}</p>
        </div>
      ) : null}
    </div>
  );
}
