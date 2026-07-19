"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MessageCircle, Plus } from "lucide-react";
import type { PaymentMethod } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatWhatsAppDisplay } from "@/lib/phone";
import {
  buildWhatsappLink,
  buildWhatsappMessage,
} from "@/lib/whatsapp";
import { centsToDecimalString, sumCents } from "@/lib/money";
import { CreateManualCreditForm } from "@/components/forms/create-manual-credit-form";
import { ApplyCreditToOrderForm } from "@/components/forms/apply-credit-to-order-form";
import { RefundCreditForm } from "@/components/forms/refund-credit-form";

const DATE_FORMAT = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "medium",
  timeStyle: "short",
});

type CreditApplication = {
  id: string;
  orderId: string;
  orderNumber: string;
  amount: string;
  createdAt: Date;
};

type CreditItem = {
  id: string;
  origin: "OVERPAYMENT" | "MANUAL" | "REFUND";
  status: "AVAILABLE" | "PARTIALLY_USED" | "USED" | "REFUNDED" | "VOIDED";
  amount: string;
  availableAmount: string;
  notes: string | null;
  createdAt: Date;
  refundedAt: Date | null;
  refundReason: string | null;
  payment: {
    id: string;
    method: PaymentMethod;
    amount: string;
    createdAt: Date;
  } | null;
  applications: CreditApplication[];
};

type Props = {
  credits: CreditItem[];
  customer: { id: string; name: string; whatsapp: string };
};

const ORIGIN_LABELS: Record<CreditItem["origin"], string> = {
  OVERPAYMENT: "Sobrepago",
  MANUAL: "Manual",
  REFUND: "Devolución",
};

const STATUS_LABELS: Record<CreditItem["status"], string> = {
  AVAILABLE: "Disponible",
  PARTIALLY_USED: "Parcial",
  USED: "Usado",
  REFUNDED: "Devuelto",
  VOIDED: "Anulado",
};

const STATUS_CLASS: Record<CreditItem["status"], string> = {
  AVAILABLE: "bg-emerald-600 text-white",
  PARTIALLY_USED: "bg-blue-200 text-blue-900",
  USED: "",
  REFUNDED: "bg-amber-500 text-white",
  VOIDED: "bg-muted text-muted-foreground",
};

export function CustomerCreditsHistory({ credits, customer }: Props) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [applyTarget, setApplyTarget] = useState<CreditItem | null>(null);
  const [refundTarget, setRefundTarget] = useState<CreditItem | null>(null);

  const totalAvailable = useMemo(() => {
    const cents = sumCents(
      credits
        .filter((c) => c.status === "AVAILABLE" || c.status === "PARTIALLY_USED")
        .map((c) => c.availableAmount),
    );
    return centsToDecimalString(cents);
  }, [credits]);

  const creditMessageLink = useMemo(
    () =>
      buildWhatsappLink(
        customer.whatsapp,
        buildWhatsappMessage({
          key: "CREDIT_AVAILABLE",
          customer: { name: customer.name, whatsapp: customer.whatsapp },
          credit: {
            totalAmount: totalAvailable,
            availableAmount: totalAvailable,
          },
        }),
      ),
    [customer.whatsapp, customer.name, totalAvailable],
  );

  const handleSuccess = useCallback(() => {
    setShowCreate(false);
    setApplyTarget(null);
    setRefundTarget(null);
    router.refresh();
  }, [router]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <CardTitle className="text-base">Historial de créditos</CardTitle>
          <CardDescription>
            {credits.length === 0
              ? `${customer.name} aún no tiene créditos.`
              : `${credits.length} crédito(s). Disponible: S/ ${totalAvailable}`}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
            <Plus className="size-4" /> Crédito manual
          </Button>
          <div className="text-xs text-muted-foreground">
            Contacto:{" "}
            <Link
              href={`https://wa.me/${customer.whatsapp.replace(/[^\d]/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {formatWhatsAppDisplay(customer.whatsapp)}
            </Link>
            {creditMessageLink ? (
              <Button
                size="xs"
                variant="ghost"
                className="ml-2"
                render={
                  <a
                    href={creditMessageLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle className="size-3" /> Avisar crédito
                  </a>
                }
              />
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {showCreate && (
          <div className="mb-4 rounded-lg border border-border bg-muted/10 p-4">
            <h3 className="mb-2 text-sm font-medium">Nuevo crédito manual</h3>
            <CreateManualCreditForm customerId={customer.id} onSuccess={handleSuccess} />
          </div>
        )}

        {applyTarget && (
          <div className="mb-4 rounded-lg border border-border bg-muted/10 p-4">
            <h3 className="mb-2 text-sm font-medium">
              Aplicar crédito S/ {applyTarget.availableAmount} a un pedido
            </h3>
            <ApplyCreditToOrderForm
              creditId={applyTarget.id}
              customerId={customer.id}
              onSuccess={handleSuccess}
            />
          </div>
        )}

        {refundTarget && (
          <div className="mb-4 rounded-lg border border-border bg-muted/10 p-4">
            <h3 className="mb-2 text-sm font-medium">
              Devolver crédito S/ {refundTarget.amount}
            </h3>
            <RefundCreditForm creditId={refundTarget.id} onSuccess={handleSuccess} />
          </div>
        )}

        {credits.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            Los créditos se generan cuando un pago validado cubre más de lo
            aplicado o cuando se registra un crédito manual desde la ficha de
            la clienta. La aplicación a un pedido se hace manualmente.
            <div className="mt-3">
              <Button
                size="sm"
                variant="outline"
                render={<Link href={`/pagos?customerId=${customer.id}`}>Ver módulo de pagos</Link>}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {credits.map((c) => (
              <div key={c.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      S/ {c.amount} ·{" "}
                      <span className="text-muted-foreground">
                        disponible S/ {c.availableAmount}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ORIGIN_LABELS[c.origin]} · creado el{" "}
                      {DATE_FORMAT.format(new Date(c.createdAt))}
                      {c.payment
                        ? ` · pago S/ ${c.payment.amount}`
                        : null}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(c.status === "AVAILABLE" || c.status === "PARTIALLY_USED") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setApplyTarget(c)}
                      >
                        Aplicar a pedido
                      </Button>
                    )}
                    {c.status === "USED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-amber-600"
                        onClick={() => setRefundTarget(c)}
                      >
                        Devolver
                      </Button>
                    )}
                    <Badge className={STATUS_CLASS[c.status]}>
                      {STATUS_LABELS[c.status]}
                    </Badge>
                  </div>
                </div>
                {c.notes ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {c.notes}
                  </p>
                ) : null}
                {c.applications.length > 0 ? (
                  <div className="mt-2 flex flex-col gap-1">
                    {c.applications.map((a) => (
                      <Link
                        key={a.id}
                        href={`/pedidos/${a.orderId}`}
                        className="flex items-center justify-between rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                      >
                        <span className="font-mono">{a.orderNumber}</span>
                        <span>S/ {a.amount}</span>
                      </Link>
                    ))}
                  </div>
                ) : null}
                {c.refundReason ? (
                  <p className="mt-2 rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-700">
                    Devolución: {c.refundReason}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
