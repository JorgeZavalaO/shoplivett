import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Truck } from "lucide-react";

import { getOrderDetailAction } from "@/actions/orders";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { OrderExpiryBadge } from "@/components/dashboard/order-expiry-badge";
import { PaymentStatusBadge } from "@/components/dashboard/payment-status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CancelUnpaidOrderForm } from "@/components/forms/cancel-unpaid-order-form";
import { requireRole, requireUser } from "@/lib/permissions";
import { formatWhatsAppDisplay } from "@/lib/phone";
import { PAYMENT_METHOD_LABELS, SALES_CHANNEL_LABELS } from "@/lib/settings-defaults";
import {
  WhatsAppActions,
} from "@/components/whatsapp/whatsapp-actions";
import { buildWhatsappLink, buildWhatsappMessage, type OrderTemplateKey } from "@/lib/whatsapp";
import { deriveOrderExpiryState } from "@/lib/orders";
import { MessageCircle } from "lucide-react";


type Params = Promise<{ id: string }>;

export default async function PedidoDetallePage({ params }: { params: Params }) {
  const user = await requireUser();
  await requireRole(["ADMIN", "SELLER"]);
  const { id } = await params;
  const order = await getOrderDetailAction(id);
  if (!order) notFound();
  const activeShipmentOrder = order.shipmentOrders[0] ?? null;

  const canCreateShipment =
    (user.role === "ADMIN" || user.role === "DISPATCH") &&
    order.status === "PAID" &&
    !activeShipmentOrder;

  const canSeeCosts = user.role === "ADMIN";
  const isPaid = order.status === "PAID";
  const channelLabel =
    SALES_CHANNEL_LABELS[order.salesChannel as keyof typeof SALES_CHANNEL_LABELS] ??
    order.salesChannel;

  const canCancelUnpaid =
    order.status === "PAYMENT_VALIDATION_PENDING" ||
    order.status === "RESERVED";

  const latestPayment = order.payments[0] ?? null;
  const expiryState = deriveOrderExpiryState(order.expiresAt, {
    status: order.status,
  });
  let defaultTemplateKey: Exclude<OrderTemplateKey, "PAYMENT_VALIDATED">;
  if (
    order.status === "EXPIRED" ||
    order.status === "CANCELLED" ||
    expiryState.isOverdue
  ) {
    defaultTemplateKey = "RESERVATION_EXPIRED";
  } else if (expiryState.isNearExpiry) {
    defaultTemplateKey = "RESERVATION_NEAR_EXPIRY";
  } else if (order.status === "PAYMENT_VALIDATION_PENDING") {
    defaultTemplateKey = "SEPARATION_PENDING_VALIDATION";
  } else {
    defaultTemplateKey = "BALANCE_REMINDER";
  }
  const baseOrder = {
    orderNumber: order.orderNumber,
    total: order.total.toString(),
    validatedPaid: order.validatedPaid.toString(),
    balance: order.balance.toString(),
    expiresAt: order.expiresAt,
    status: order.status,
  } as const;
  const baseCustomer = {
    name: order.customer.name,
    whatsapp: order.customer.whatsapp,
  } as const;
  const fallbackPayment = latestPayment
    ? {
        amount: latestPayment.amount.toString(),
        method: latestPayment.method,
        operationNumber: latestPayment.operationNumber,
      }
    : { amount: order.total.toString(), method: "OTHER" as const };
  const whatsappMessage =
    order.status === "PAID"
      ? buildWhatsappMessage({
          key: "PAYMENT_VALIDATED",
          customer: baseCustomer,
          order: baseOrder,
          payment: fallbackPayment,
        })
      : buildWhatsappMessage({
          key: defaultTemplateKey,
          customer: baseCustomer,
          order: baseOrder,
        });
  const whatsappLink = buildWhatsappLink(
    order.customer.whatsapp,
    whatsappMessage,
  );
  const hasContext =
    whatsappLink !== null;

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
          <OrderExpiryBadge
            expiresAt={order.expiresAt}
            status={order.status}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/clientes/${order.customer.id}`} className="hover:underline">
            {order.customer.name}
          </Link>
          {" · Canal: "}
          <span className="font-medium">{channelLabel}</span>
          {" · "}
          <a
            href={whatsappLink ?? `https://wa.me/${order.customer.whatsapp.replace(/[^\d]/g, "")}`}
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
          {activeShipmentOrder ? (
            <>
              {" · Envío: "}
              <Link
                href={`/envios/${activeShipmentOrder.shipment.id}`}
                className="font-mono hover:underline"
              >
                {activeShipmentOrder.shipment.id.slice(-6).toUpperCase()}
              </Link>
            </>
          ) : null}
        </p>
        {canCreateShipment ? (
          <div className="mt-2">
            <Button
              size="sm"
              variant="outline"
              render={
                <Link
                  href={`/envios/nuevo?customerId=${order.customer.id}&orderId=${order.id}`}
                >
                  <Truck className="size-4" /> Crear envío con este pedido
                </Link>
              }
            />
          </div>
        ) : null}
        {canCancelUnpaid ? (
          <div className="mt-3 max-w-md rounded-lg border border-amber-300 bg-amber-50 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-800">
              <AlertTriangle className="size-4" />
              <span>Reserva sin pago validado</span>
            </div>
            <p className="mb-3 text-xs text-amber-700">
              Si el pedido no se va a pagar, cancela la reserva para liberar
              el stock reservado. Los pagos pendientes del pedido se
              rechazarán.
            </p>
            <CancelUnpaidOrderForm
              orderId={order.id}
              orderNumber={order.orderNumber}
            />
          </div>
        ) : null}
        {hasContext ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              render={
                <a
                  href={whatsappLink ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="size-4" /> Abrir chat
                </a>
              }
            />
            <span className="text-xs text-muted-foreground">
              Usa el panel de WhatsApp para enviar plantillas con variables.
            </span>
          </div>
        ) : null}
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

      {canSeeCosts && isPaid ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Utilidad reconocida</CardTitle>
            <CardDescription>
              Snapshots congelados al pasar el pedido a pagado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Costo de productos</p>
                <p className="font-mono text-sm">
                  S/ {order.productCostPen.toString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Utilidad bruta</p>
                <p className="font-mono text-sm text-emerald-600">
                  S/ {order.grossProfitPen.toString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Comisión de pago + empaque
                </p>
                <p className="font-mono text-sm text-amber-600">
                  S/ {Number(order.paymentFeePen.toString()) +
                    Number(order.packagingCostPen.toString())}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Utilidad neta</p>
                <p className="font-mono text-base font-semibold">
                  S/ {order.netProfitPen.toString()}
                </p>
              </div>
            </div>
            {order.profitCalculatedAt ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Calculado el{" "}
                {new Intl.DateTimeFormat("es-PE", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(order.profitCalculatedAt))}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

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
                    className="flex flex-col gap-1 rounded-lg border border-border px-3 py-2"
                  >
                    <div className="flex items-center justify-between">
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
                    {canSeeCosts ? (
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>
                          Costo unit: S/ {Number(item.unitCostPen.toString()).toFixed(4)}
                        </span>
                        <span>
                          Costo total: S/ {item.totalCostPen.toString()}
                        </span>
                        <span>
                          Utilidad: S/ {item.grossProfitPen.toString()}
                        </span>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">
                          {item.costSource === "BATCH"
                            ? "Lote"
                            : item.costSource === "LEGACY"
                              ? "Legado"
                              : "Sin costo"}
                        </span>
                        {item.allocations.length > 0 ? (
                          <span>
                            Lotes:{" "}
                            {item.allocations
                              .map(
                                (a) =>
                                  `${a.quantity}× S/ ${Number(a.unitCostPen.toString()).toFixed(4)}`,
                              )
                              .join(" · ")}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
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
              Los saldos solo se actualizan al validar los pagos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {order.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin pagos registrados.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {order.payments.map((payment) => (
                  <Link
                    key={payment.id}
                    href={`/pagos/${payment.id}`}
                    className="block rounded-lg border border-border p-3 hover:bg-muted"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {PAYMENT_METHOD_LABELS[payment.method]} · S/ {payment.amount.toString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Intl.DateTimeFormat("es-PE", {
                            dateStyle: "short",
                            timeStyle: "short",
                          }).format(new Date(payment.createdAt))}
                        </p>
                      </div>
                      <PaymentStatusBadge status={payment.status} />
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
                            src={`/api/payment-receipts/${r.id}`}
                            alt="Captura"
                            className="aspect-square rounded-md border border-border object-cover"
                          />
                        ))}
                      </div>
                    ) : null}
                  </Link>
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

      {hasContext ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mensajes para WhatsApp</CardTitle>
            <CardDescription>
              Copia el mensaje o ábrelo directamente en WhatsApp Web. No se
              envía automáticamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WhatsAppActions
              customer={{
                name: order.customer.name,
                whatsapp: order.customer.whatsapp,
              }}
              context={{
                hasOrder: true,
                hasPayment: Boolean(latestPayment),
                hasShipment: Boolean(activeShipmentOrder),
                hasCredit: false,
              }}
              order={{
                orderNumber: order.orderNumber,
                total: order.total.toString(),
                validatedPaid: order.validatedPaid.toString(),
                balance: order.balance.toString(),
                expiresAt: order.expiresAt,
                status: order.status,
              }}
              payment={
                latestPayment
                  ? {
                      amount: latestPayment.amount.toString(),
                      method: latestPayment.method,
                      operationNumber: latestPayment.operationNumber,
                    }
                  : undefined
              }
              defaultTemplate={defaultTemplateKey}
              precomputedLink={whatsappLink}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
