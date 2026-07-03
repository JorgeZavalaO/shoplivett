import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Image as ImageIcon } from "lucide-react";

import { getPaymentDetailAction } from "@/actions/payments";
import { PaymentStatusBadge } from "@/components/dashboard/payment-status-badge";
import { PaymentActions } from "@/components/forms/payment-actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PAYMENT_METHOD_LABELS } from "@/lib/settings-defaults";
import { canValidatePayments, requireUser } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { formatWhatsAppDisplay } from "@/lib/phone";
import { WhatsAppActions } from "@/components/whatsapp/whatsapp-actions";
import { buildWhatsappLink, buildWhatsappMessage } from "@/lib/whatsapp";
import { MessageCircle } from "lucide-react";


type Params = Promise<{ id: string }>;

const ORDER_STATUS_LABELS: Record<string, string> = {
  PAYMENT_VALIDATION_PENDING: "Validación pendiente",
  RESERVED: "Reservada",
  PARTIALLY_PAID: "Saldo pendiente",
  PAID: "Pagada",
  CANCELLED: "Cancelada",
  EXPIRED: "Vencida",
};

export default async function PagoDetallePage({ params }: { params: Params }) {
  const { id } = await params;
  const user = await requireUser();
  const payment = await getPaymentDetailAction(id);
  if (!payment) notFound();
  const settings = await getSettings();

  const canValidate = await canValidatePayments(user.role);
  const isPending = payment.status === "PENDING";
  const appliedSum = payment.applications.reduce(
    (acc, a) => acc + Number(a.amount.toString()),
    0,
  );
  const amountNum = Number(payment.amount.toString());
  const remaining = amountNum - appliedSum;

  const firstApp = payment.applications[0]?.order ?? null;
  const whatsappLink = buildWhatsappLink(
    payment.customer.whatsapp,
    buildWhatsappMessage({
      key: payment.status === "VALIDATED" ? "PAYMENT_VALIDATED" : "SEPARATION_PENDING_VALIDATION",
      customer: {
        name: payment.customer.name,
        whatsapp: payment.customer.whatsapp,
      },
      order: firstApp
        ? {
            orderNumber: firstApp.orderNumber,
            total: firstApp.total.toString(),
            validatedPaid: firstApp.validatedPaid.toString(),
            balance: firstApp.balance.toString(),
            expiresAt: new Date(),
            status: firstApp.status,
          }
        : {
            orderNumber: payment.order?.orderNumber ?? payment.id.slice(-6).toUpperCase(),
            total: payment.amount.toString(),
            validatedPaid: "0",
            balance: payment.amount.toString(),
            expiresAt: new Date(),
          },
      payment: {
        amount: payment.amount.toString(),
        method: payment.method,
        operationNumber: payment.operationNumber,
      },
    }),
  );
  const hasContext = whatsappLink !== null;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2"
          render={
            <Link href="/pagos">
              <ArrowLeft className="size-4" /> Pagos
            </Link>
          }
        />
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Pago {payment.id.slice(-6).toUpperCase()}
          </h1>
          <PaymentStatusBadge status={payment.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {PAYMENT_METHOD_LABELS[payment.method]} ·{" "}
          {new Intl.DateTimeFormat("es-PE", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(payment.createdAt))}
          {payment.operationNumber ? ` · N° op. ${payment.operationNumber}` : null}
        </p>
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
              Genera plantillas de pago y validación desde la sección de WhatsApp.
            </span>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Monto</CardDescription>
            <CardTitle className="text-2xl">S/ {payment.amount.toString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Aplicado a pedidos</CardDescription>
            <CardTitle className="text-2xl text-emerald-600">
              S/ {appliedSum.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {payment.applications.length} pedido(s).
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>
              {remaining > 0 ? "Restante por aplicar" : remaining < 0 ? "Excedente" : "Cuadra exacto"}
            </CardDescription>
            <CardTitle
              className={
                "text-2xl " +
                (remaining > 0
                  ? "text-amber-600"
                  : remaining < 0
                    ? "text-destructive"
                    : "text-emerald-600")
              }
            >
              S/ {remaining.toFixed(2)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Pedidos aplicados</CardTitle>
            <CardDescription>
              Los saldos de los pedidos solo se actualizan al validar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {payment.applications.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Este pago aún no tiene pedidos aplicados.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {payment.applications.map((a) => (
                  <Link
                    key={a.id}
                    href={`/pedidos/${a.order.id}`}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
                  >
                    <div>
                      <p className="font-mono text-xs font-medium">
                        {a.order.orderNumber}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ORDER_STATUS_LABELS[a.order.status] ?? a.order.status} · Saldo
                        S/ {a.order.balance.toString()}
                      </p>
                    </div>
                    <span className="font-mono text-sm">S/ {a.amount.toString()}</span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Validación</CardTitle>
            <CardDescription>
              {isPending
                ? "El pago está pendiente de revisión."
                : payment.status === "VALIDATED"
                  ? `Validado${payment.validatedAt ? ` el ${new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(payment.validatedAt))}` : ""}.`
                  : `Rechazado${payment.rejectedAt ? ` el ${new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(payment.rejectedAt))}` : ""}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {payment.rejectionReason ? (
              <p className="rounded-md bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
                Motivo: {payment.rejectionReason}
              </p>
            ) : null}
            {isPending ? (
              <PaymentActions
                paymentId={payment.id}
                canValidate={canValidate}
                allowCredit={settings.allowOverpaymentCredit}
                allowRefund={settings.allowRefund}
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                El pago ya fue procesado.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clienta</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">{payment.customer.name}</p>
            <p className="text-xs text-muted-foreground">
              <Link
                href={`/clientes/${payment.customer.id}`}
                className="hover:underline"
              >
                {formatWhatsAppDisplay(payment.customer.whatsapp)}
              </Link>
            </p>
            {payment.order ? (
              <>
                <Separator className="my-3" />
                <p className="text-xs text-muted-foreground">
                  Origen: pedido{" "}
                  <Link
                    href={`/pedidos/${payment.order.id}`}
                    className="font-mono hover:underline"
                  >
                    {payment.order.orderNumber}
                  </Link>
                </p>
              </>
            ) : null}
            {payment.notes ? (
              <>
                <Separator className="my-3" />
                <p className="text-xs text-muted-foreground">Notas</p>
                <p className="whitespace-pre-wrap text-sm">{payment.notes}</p>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Capturas</CardTitle>
            <CardDescription>
              Subir capturas no valida el pago automáticamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {payment.receipts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin capturas.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {payment.receipts.map((r) => (
                  <a
                    key={r.id}
                    href={`/api/payment-receipts/${r.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/payment-receipts/${r.id}`}
                      alt="Captura"
                      className="aspect-square w-full rounded-md border border-border object-cover"
                    />
                    <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100">
                      Ver
                    </span>
                  </a>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
              <ImageIcon className="size-3" /> Las capturas se almacenan en Vercel Blob.
            </p>
          </CardContent>
        </Card>
      </div>

      {hasContext ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mensajes para WhatsApp</CardTitle>
            <CardDescription>
              Copia el mensaje o ábrelo en WhatsApp Web para confirmar el pago.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WhatsAppActions
              customer={{
                name: payment.customer.name,
                whatsapp: payment.customer.whatsapp,
              }}
              context={{
                hasOrder: Boolean(firstApp),
                hasPayment: true,
                hasShipment: false,
                hasCredit: false,
              }}
              order={
                firstApp
                  ? {
                      orderNumber: firstApp.orderNumber,
                      total: firstApp.total.toString(),
                      validatedPaid: firstApp.validatedPaid.toString(),
                      balance: firstApp.balance.toString(),
                      expiresAt: new Date(),
                      status: firstApp.status,
                    }
                  : {
                      orderNumber:
                        payment.order?.orderNumber ?? payment.id.slice(-6).toUpperCase(),
                      total: payment.amount.toString(),
                      validatedPaid: "0",
                      balance: payment.amount.toString(),
                      expiresAt: new Date(),
                    }
              }
              payment={{
                amount: payment.amount.toString(),
                method: payment.method,
                operationNumber: payment.operationNumber,
              }}
              defaultTemplate={
                payment.status === "VALIDATED"
                  ? "PAYMENT_VALIDATED"
                  : "SEPARATION_PENDING_VALIDATION"
              }
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
