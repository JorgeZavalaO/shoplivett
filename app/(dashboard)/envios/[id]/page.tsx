import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getShipmentDetailAction } from "@/actions/shipments";
import { ShipmentStatusBadge } from "@/components/dashboard/shipment-status-badge";
import { ShipmentStatusActions } from "@/components/forms/shipment-status-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { canTransition, SHIPMENT_STATUS_LABELS } from "@/lib/shipments";
import { SHIPPING_METHOD_LABELS } from "@/lib/settings-defaults";
import { requireRole } from "@/lib/permissions";
import { formatWhatsAppDisplay } from "@/lib/phone";
import { WhatsAppActions } from "@/components/whatsapp/whatsapp-actions";
import { buildWhatsappLink, buildWhatsappMessage } from "@/lib/whatsapp";
import { MessageCircle } from "lucide-react";


type Params = Promise<{ id: string }>;

type ShipmentStatus =
  | "PENDING"
  | "PREPARING"
  | "READY"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

const ALL_TRANSITIONS: ShipmentStatus[] = [
  "PREPARING",
  "READY",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];

export default async function EnvioDetallePage({ params }: { params: Params }) {
  await requireRole(["ADMIN", "DISPATCH"]);
  const { id } = await params;
  const shipment = await getShipmentDetailAction(id);
  if (!shipment) notFound();

  const availableTransitions = ALL_TRANSITIONS.filter((t) =>
    canTransition(shipment.status, t),
  );

  const whatsappLink = `https://wa.me/${shipment.customer.whatsapp.replace(/[^\d]/g, "")}`;

  const firstOrder = shipment.orders[0]?.order ?? null;
  const shipmentMessageLink = buildWhatsappLink(
    shipment.customer.whatsapp,
    buildWhatsappMessage({
      key: "SHIPMENT_SENT",
      customer: {
        name: shipment.customer.name,
        whatsapp: shipment.customer.whatsapp,
      },
      order: firstOrder
        ? {
            orderNumber: firstOrder.orderNumber,
            total: firstOrder.total.toString(),
            balance: firstOrder.balance.toString(),
            expiresAt: new Date(),
            status: firstOrder.status,
          }
        : {
            orderNumber: shipment.id.slice(-6).toUpperCase(),
            total: "0",
            balance: "0",
            expiresAt: new Date(),
          },
      shipment: {
        shippingMethod: shipment.shippingMethod,
        agencyName: shipment.agencyName,
        trackingCode: shipment.trackingCode,
      },
    }),
  );
  const hasContext = shipmentMessageLink !== null;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2"
          render={
            <Link href="/envios">
              <ArrowLeft className="size-4" /> Envíos
            </Link>
          }
        />
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Envío {shipment.id.slice(-6).toUpperCase()}
          </h1>
          <ShipmentStatusBadge status={shipment.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {SHIPPING_METHOD_LABELS[shipment.shippingMethod]} ·{" "}
          <Link
            href={`/clientes/${shipment.customer.id}`}
            className="hover:underline"
          >
            {shipment.customer.name}
          </Link>
          {" · "}
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            {formatWhatsAppDisplay(shipment.customer.whatsapp)}
          </a>
        </p>
        {hasContext ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              render={
                <a
                  href={shipmentMessageLink ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="size-4" /> Avisar envío
                </a>
              }
            />
            <span className="text-xs text-muted-foreground">
              Genera el mensaje con agencia y tracking desde la sección de WhatsApp.
            </span>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Costo</CardDescription>
            <CardTitle
              className={
                "text-2xl " + (shipment.isFreeShipping ? "text-emerald-600" : "")
              }
            >
              {shipment.isFreeShipping ? "Gratis" : `S/ ${shipment.shippingCost.toString()}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {shipment.isFreeShipping ? "Marcado como envío gratis." : "Costo registrado al crear."}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Agencia</CardDescription>
            <CardTitle className="text-base">
              {shipment.agencyName ?? "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Tracking</CardDescription>
            <CardTitle className="text-base font-mono">
              {shipment.trackingCode ?? "—"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Pedidos incluidos</CardTitle>
            <CardDescription>
              {shipment.orders.length} pedido(s) en este envío.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {shipment.orders.map((so) => (
                <Link
                  key={so.id}
                  href={`/pedidos/${so.order.id}`}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
                >
                  <div>
                    <p className="font-mono text-xs font-medium">
                      {so.order.orderNumber}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {so.order.status} · Total S/ {so.order.total.toString()}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Saldo S/ {so.order.balance.toString()}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acciones</CardTitle>
            <CardDescription>
              Cambia el estado del envío. La cancelación libera los pedidos
              para un nuevo envío.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ShipmentStatusActions
              shipmentId={shipment.id}
              status={shipment.status}
              availableTransitions={availableTransitions}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dirección de envío</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm md:grid-cols-3">
            <div className="md:col-span-3">
              <p className="text-xs text-muted-foreground">Dirección</p>
              <p>{shipment.addressSnapshot ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Distrito</p>
              <p>{shipment.districtSnapshot ?? "—"}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-xs text-muted-foreground">Referencia</p>
              <p className="whitespace-pre-wrap">
                {shipment.referenceSnapshot ?? "—"}
              </p>
            </div>
            {shipment.notes ? (
              <div className="md:col-span-3">
                <Separator className="my-2" />
                <p className="text-xs text-muted-foreground">Notas</p>
                <p className="whitespace-pre-wrap">{shipment.notes}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Línea de tiempo</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <TimelineRow
              label="Creado"
              value={shipment.createdAt}
              active
            />
            <TimelineRow label="Preparando" value={shipment.preparedAt} />
            <TimelineRow label="Enviado" value={shipment.shippedAt} />
            <TimelineRow label="Entregado" value={shipment.deliveredAt} />
            <TimelineRow
              label="Cancelado"
              value={shipment.cancelledAt}
              destructive
            />
            {shipment.createdBy ? (
              <p className="text-xs text-muted-foreground">
                Creado por {shipment.createdBy.name ?? shipment.createdBy.email}
              </p>
            ) : null}
            {shipment.updatedBy ? (
              <p className="text-xs text-muted-foreground">
                Última edición: {shipment.updatedBy.name ?? shipment.updatedBy.email}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {hasContext ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mensajes para WhatsApp</CardTitle>
            <CardDescription>
              Comparte el estado del envío con la clienta. Solo se abre el chat
              o se copia el texto.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WhatsAppActions
              customer={{
                name: shipment.customer.name,
                whatsapp: shipment.customer.whatsapp,
              }}
              context={{
                hasOrder: Boolean(firstOrder),
                hasPayment: false,
                hasShipment: true,
                hasCredit: false,
              }}
              order={
                firstOrder
                  ? {
                      orderNumber: firstOrder.orderNumber,
                      total: firstOrder.total.toString(),
                      balance: firstOrder.balance.toString(),
                      expiresAt: new Date(),
                      status: firstOrder.status,
                    }
                  : {
                      orderNumber: shipment.id.slice(-6).toUpperCase(),
                      total: "0",
                      balance: "0",
                      expiresAt: new Date(),
                    }
              }
              shipment={{
                shippingMethod: shipment.shippingMethod,
                agencyName: shipment.agencyName,
                trackingCode: shipment.trackingCode,
              }}
              defaultTemplate="SHIPMENT_SENT"
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function TimelineRow({
  label,
  value,
  active,
  destructive,
}: {
  label: string;
  value: Date | null;
  active?: boolean;
  destructive?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {value ? (
        <span className={destructive ? "text-destructive" : ""}>
          {new Intl.DateTimeFormat("es-PE", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(value))}
        </span>
      ) : (
        <Badge variant={active ? "secondary" : "outline"}>
          {SHIPMENT_STATUS_LABELS.PENDING}
        </Badge>
      )}
    </div>
  );
}
