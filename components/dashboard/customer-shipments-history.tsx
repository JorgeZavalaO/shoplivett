"use client"

import * as React from "react"
import Link from "next/link"
import { History, Truck, ExternalLink } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ShipmentStatusBadge } from "@/components/dashboard/shipment-status-badge"
import { SHIPPING_METHOD_LABELS } from "@/lib/settings-defaults"

type ShipmentItem = {
  id: string;
  status:
    | "PENDING"
    | "PREPARING"
    | "READY"
    | "SHIPPED"
    | "DELIVERED"
    | "CANCELLED";
  shippingMethod:
    | "DELIVERY_PROPIO"
    | "OLVA"
    | "SHALOM"
    | "MOTORIZADO"
    | "RECOJO";
  shippingCost: string;
  isFreeShipping: boolean;
  agencyName: string | null;
  trackingCode: string | null;
  createdAt: Date;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  orderCount: number;
  orders: { id: string; orderNumber: string; total: string }[];
};

type Props = {
  shipments: ShipmentItem[];
};

const DATE_FORMAT = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "medium",
  timeStyle: "short",
});

function ShipmentRow({ shipment }: { shipment: ShipmentItem }) {
  return (
    <Link
      href={`/envios/${shipment.id}`}
      className="block rounded-xl border border-border p-4 transition-colors hover:bg-muted"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Truck className="size-4 text-muted-foreground" />
            <p className="text-sm font-semibold">
              {SHIPPING_METHOD_LABELS[shipment.shippingMethod]}
            </p>
            <ShipmentStatusBadge status={shipment.status} />
            {shipment.cancelledAt ? (
              <Badge variant="destructive">Cancelado</Badge>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {DATE_FORMAT.format(new Date(shipment.createdAt))} ·{" "}
            {shipment.orderCount} pedido(s)
            {shipment.trackingCode
              ? ` · tracking ${shipment.trackingCode}`
              : shipment.agencyName
                ? ` · ${shipment.agencyName}`
                : null}
          </p>
          {shipment.orders.length > 0 ? (
            <div className="mt-2 flex flex-col gap-1">
              {shipment.orders.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between rounded-md bg-muted/40 px-2 py-1 text-xs"
                >
                  <span className="font-mono">{o.orderNumber}</span>
                  <span className="font-medium">S/ {o.total}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1">
          <p className="text-sm font-semibold">
            {shipment.isFreeShipping ? (
              <span className="text-emerald-600">Gratis</span>
            ) : (
              `S/ ${shipment.shippingCost}`
            )}
          </p>
          <p className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            Ver detalle <ExternalLink className="size-3" />
          </p>
        </div>
      </div>
    </Link>
  );
}

export function CustomerShipmentsHistory({ shipments }: Props) {
  const total = shipments.length;
  const inTransit = shipments.filter(
    (s) => s.status === "SHIPPED" || s.status === "READY",
  ).length;
  const delivered = shipments.filter((s) => s.status === "DELIVERED").length;

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="size-4 text-muted-foreground" /> Envíos
          </CardTitle>
          <CardDescription>
            {total === 0
              ? "Esta clienta aún no tiene envíos."
              : `${total} envío(s) registrado(s).`}
          </CardDescription>
        </div>
        <Dialog>
          <DialogTrigger
            render={
              <Button
                size="sm"
                variant="outline"
                disabled={total === 0}
                className="w-fit"
              >
                <History className="size-4" /> Ver historial completo
              </Button>
            }
          />
          <DialogContent size="xl">
            <DialogHeader>
              <DialogTitle>Historial de envíos</DialogTitle>
              <DialogDescription>
                {total} envío(s) registrado(s) · {inTransit} en tránsito ·{" "}
                {delivered} entregado(s)
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {shipments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Los envíos se crean desde el módulo de Envíos y agrupan
                  pedidos pagados de la misma clienta.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {shipments.map((s) => (
                    <ShipmentRow key={s.id} shipment={s} />
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">
            Los envíos se crean desde el módulo de Envíos y agrupan pedidos
            pagados de la misma clienta. La cancelación se puede revertir desde
            el detalle del envío.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Total</p>
              <p className="text-lg font-semibold">{total}</p>
            </div>
            <div className="rounded-lg border border-amber-200/80 bg-amber-50/40 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wider text-amber-700">En tránsito</p>
              <p className="text-lg font-semibold text-amber-700">{inTransit}</p>
            </div>
            <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/40 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wider text-emerald-700">Entregados</p>
              <p className="text-lg font-semibold text-emerald-700">{delivered}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
