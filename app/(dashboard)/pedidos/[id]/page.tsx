import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getOrderDetailAction } from "@/actions/orders";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatWhatsAppDisplay } from "@/lib/phone";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function PedidoDetallePage({ params }: { params: Params }) {
  const { id } = await params;
  const order = await getOrderDetailAction(id);
  if (!order) notFound();

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2"
          render={<Link href="/pedidos"><ArrowLeft className="size-4" /> Pedidos</Link>}
        />
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {order.orderNumber}
          </h1>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/clientes/${order.customer.id}`} className="hover:underline">
            {order.customer.name}
          </Link>
          {" · "}
          <a
            href={`https://wa.me/${order.customer.whatsapp.replace(/[^\d]/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            {formatWhatsAppDisplay(order.customer.whatsapp)}
          </a>
          {order.liveSession ? (
            <>
              {" · Live: "}
              <Link href={`/lives/${order.liveSession.id}`} className="hover:underline">
                {order.liveSession.name}
              </Link>
            </>
          ) : null}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Total</CardDescription>
            <CardTitle className="text-2xl">S/ {order.total.toString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Validado</CardDescription>
            <CardTitle className="text-2xl text-emerald-600">
              S/ {order.validatedPaid.toString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Saldo pendiente</CardDescription>
            <CardTitle className="text-2xl text-amber-600">
              S/ {order.balance.toString()}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Vence:{" "}
            {new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(
              new Date(order.expiresAt),
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Items del pedido</CardTitle>
          </CardHeader>
          <CardContent>
            {order.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin items.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {item.variant.product.name}
                        {item.variant.color ? ` · ${item.variant.color}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.variant.code} · S/ {item.unitPrice.toString()} x{" "}
                        {item.quantity}
                      </p>
                    </div>
                    <span className="font-mono text-sm">
                      S/ {item.lineTotal.toString()}
                    </span>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>S/ {order.subtotal.toString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Descuento</span>
                  <span>S/ {order.discount.toString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Envío</span>
                  <span>S/ {order.shippingAmount.toString()}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm font-semibold">
                  <span>Total</span>
                  <span>S/ {order.total.toString()}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pagos y capturas</CardTitle>
            <CardDescription>
              Los pagos se validan manualmente desde el módulo de Pagos (Sprint 8).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {order.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin pagos registrados.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {order.payments.map((payment) => (
                  <div key={payment.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {payment.method} · S/ {payment.amount.toString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Intl.DateTimeFormat("es-PE", {
                            dateStyle: "short",
                            timeStyle: "short",
                          }).format(new Date(payment.createdAt))}
                        </p>
                      </div>
                      <Badge
                        variant={
                          payment.status === "PENDING"
                            ? "secondary"
                            : payment.status === "VALIDATED"
                              ? "default"
                              : "destructive"
                        }
                      >
                        {payment.status === "PENDING"
                          ? "Pendiente"
                          : payment.status === "VALIDATED"
                            ? "Validado"
                            : "Rechazado"}
                      </Badge>
                    </div>
                    {payment.operationNumber ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        N° op.: {payment.operationNumber}
                      </p>
                    ) : null}
                    {payment.receipts.length > 0 ? (
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {payment.receipts.map((r) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={r.id}
                            src={r.url}
                            alt="Captura"
                            className="aspect-square rounded-md border border-border object-cover"
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
            {order.notes ? (
              <>
                <Separator className="my-3" />
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {order.notes}
                </p>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
