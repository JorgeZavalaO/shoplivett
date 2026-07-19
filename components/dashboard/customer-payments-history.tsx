"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { Wallet, ChevronLeft, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listCustomerPaymentsAction, type CustomerPaymentItem } from "@/actions/payments";

const DATETIME_FORMAT = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "medium",
  timeStyle: "short",
});

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  YAPE: "Yape",
  PLIN: "Plin",
  CASH: "Efectivo",
  OTHER: "Otro",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  VALIDATED: "Validado",
  REJECTED: "Rechazado",
};

const PAYMENT_STATUS_CLASS: Record<string, string> = {
  PENDING: "bg-amber-500 text-white",
  VALIDATED: "bg-emerald-600 text-white",
  REJECTED: "bg-destructive text-destructive-foreground",
};

type Props = {
  customerId: string;
  initialData: {
    items: CustomerPaymentItem[];
    total: number;
    page: number;
    perPage: number;
  };
};

export function CustomerPaymentsHistory({ customerId, initialData }: Props) {
  const [page, setPage] = useState(initialData.page);
  const [data, setData] = useState(initialData);
  const [isPending, startTransition] = useTransition();
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(data.total / data.perPage)),
    [data.total, data.perPage],
  );

  function loadPage(newPage: number) {
    startTransition(async () => {
      const result = await listCustomerPaymentsAction(customerId, { page: newPage, perPage: data.perPage });
      setData(result);
      setPage(newPage);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Wallet className="size-4 text-muted-foreground" />
          Pagos
        </CardTitle>
        <CardDescription>
          {data.total === 0
            ? "Esta clienta aún no tiene pagos."
            : `${data.total} pago(s).`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Los pagos se registran desde el módulo de Pagos.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {data.items.map((p) => (
              <Link
                key={p.id}
                href={`/pagos/${p.id}`}
                className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted"
              >
                <div>
                  <p className="text-sm font-medium">
                    S/ {p.amount} · {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {DATETIME_FORMAT.format(new Date(p.createdAt))}
                    {p.orderNumbers.length > 0 && (
                      <> · {p.orderNumbers.join(", ")}</>
                    )}
                  </p>
                </div>
                <Badge className={PAYMENT_STATUS_CLASS[p.status] ?? ""}>
                  {PAYMENT_STATUS_LABELS[p.status] ?? p.status}
                </Badge>
              </Link>
            ))}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-muted-foreground">
                  Pág. {page} de {totalPages}
                </p>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1 || isPending}
                    onClick={() => loadPage(page - 1)}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages || isPending}
                    onClick={() => loadPage(page + 1)}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
