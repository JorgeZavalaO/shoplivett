import Link from "next/link";
import { Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ShipmentStatusBadge } from "@/components/dashboard/shipment-status-badge";
import { SHIPPING_METHOD_LABELS } from "@/lib/settings-defaults";

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

export function CustomerShipmentsHistory({ shipments }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Historial de envíos</CardTitle>
        <CardDescription>
          {shipments.length === 0
            ? "Esta clienta aún no tiene envíos."
            : `${shipments.length} envío(s) registrado(s).`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {shipments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Los envíos se crean desde el módulo de Envíos y agrupan pedidos
            pagados de la misma clienta. La cancelación se puede revertir
            desde el detalle del envío.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {shipments.map((s) => (
              <Link
                key={s.id}
                href={`/envios/${s.id}`}
                className="rounded-lg border border-border p-3 transition-colors hover:bg-muted"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Truck className="size-4 text-muted-foreground" />
                      {SHIPPING_METHOD_LABELS[s.shippingMethod]} ·{" "}
                      {s.isFreeShipping ? (
                        <span className="text-emerald-600">Gratis</span>
                      ) : (
                        `S/ ${s.shippingCost}`
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat("es-PE", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(s.createdAt))}{" "}
                      · {s.orderCount} pedido(s)
                      {s.trackingCode
                        ? ` · tracking ${s.trackingCode}`
                        : s.agencyName
                          ? ` · ${s.agencyName}`
                          : null}
                    </p>
                  </div>
                  <ShipmentStatusBadge status={s.status} />
                </div>
                {s.orders.length > 0 ? (
                  <div className="mt-2 flex flex-col gap-1">
                    {s.orders.map((o) => (
                      <div
                        key={o.id}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="font-mono">{o.orderNumber}</span>
                        <span>S/ {o.total}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {s.cancelledAt ? (
                  <Badge variant="destructive" className="mt-2">
                    Cancelado
                  </Badge>
                ) : null}
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
