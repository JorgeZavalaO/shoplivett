"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AsyncSearchList } from "@/components/ui/async-search-list";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import {
  updatePaymentApplicationsAction,
  searchOrdersForPaymentAction,
  type PaymentActionResult,
} from "@/actions/payments";

type OrderOption = {
  id: string;
  orderNumber: string;
  total: string;
  balance: string;
  status: string;
};

type Application = {
  orderId: string;
  orderNumber: string;
  balance: string;
  amount: string;
};

type Props = {
  paymentId: string;
  paymentAmount: string;
  customerId: string;
  initialApplications: Application[];
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  PAYMENT_VALIDATION_PENDING: "Validación pendiente",
  RESERVED: "Reservada",
  PARTIALLY_PAID: "Saldo pendiente",
};

export function EditPaymentApplicationsForm({
  paymentId,
  paymentAmount,
  customerId,
  initialApplications,
}: Props) {
  const router = useRouter();
  const [state, setState] = useState<PaymentActionResult>({ ok: false });
  const [applications, setApplications] = useState<Application[]>(initialApplications);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();

  const [orderQuery, setOrderQuery] = useState("");
  const [orderResults, setOrderResults] = useState<OrderOption[]>([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [, searchOrders] = useTransition();

  const searchOrd = useCallback(
    async (q: string) => {
      setOrderQuery(q);
      setOrderLoading(true);
      setOrderError(null);
      searchOrders(async () => {
        try {
          const res = await searchOrdersForPaymentAction(q, customerId);
          setOrderResults(res);
        } catch (err) {
          console.error(err);
          setOrderError("No pudimos buscar pedidos. Intenta nuevamente.");
          setOrderResults([]);
        } finally {
          setOrderLoading(false);
        }
      });
    },
    [customerId, searchOrders],
  );

  const paymentNum = Number(paymentAmount) || 0;
  const appliedSum = useMemo(
    () => applications.reduce((acc, a) => acc + (Number(a.amount) || 0), 0),
    [applications],
  );
  const remaining = paymentNum - appliedSum;

  function addOrder(o: OrderOption) {
    if (applications.some((a) => a.orderId === o.id)) return;
    const remainingForOrder = Math.max(
      0,
      Math.min(Number(o.balance), Math.max(0, remaining)),
    );
    setApplications((prev) => [
      ...prev,
      {
        orderId: o.id,
        orderNumber: o.orderNumber,
        balance: o.balance,
        amount: remainingForOrder > 0 ? remainingForOrder.toFixed(2) : o.balance,
      },
    ]);
    setOrderQuery("");
    setOrderResults([]);
  }

  function removeApp(orderId: string) {
    setApplications((prev) => prev.filter((a) => a.orderId !== orderId));
  }

  function setAppAmount(orderId: string, value: string) {
    setApplications((prev) =>
      prev.map((a) => (a.orderId === orderId ? { ...a, amount: value } : a)),
    );
  }

  const canSubmit =
    applications.length > 0 &&
    remaining >= -0.01 &&
    applications.every((a) => Number(a.amount) > 0);

  const hasChanges = JSON.stringify(applications) !== JSON.stringify(initialApplications);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit || !hasChanges) return;
    setConfirmOpen(true);
  }

  async function handleConfirm() {
    setPending(true);
    const fd = new FormData();
    fd.set("paymentId", paymentId);
    fd.set(
      "applications",
      JSON.stringify(applications.map((a) => ({ orderId: a.orderId, amount: a.amount }))),
    );
    const result = await updatePaymentApplicationsAction(undefined, fd);
    setPending(false);
    setConfirmOpen(false);
    setState(result);
    if (result.ok) {
      startTransition(() => router.refresh());
    }
  }

  return (
    <>
      <form className="flex flex-col gap-3" noValidate onSubmit={handleSubmit}>
        <AsyncSearchList
          value={orderQuery}
          onValueChange={setOrderQuery}
          onSearch={(q) => void searchOrd(q)}
          isLoading={orderLoading}
          isQueryTooShort={false}
          results={orderResults.filter(
            (o) => !applications.some((a) => a.orderId === o.id),
          )}
          errorMessage={orderError}
          placeholder="Buscar pedido por número…"
          emptyMessage="Escribe para buscar pedidos con saldo."
          noResultsMessage="No hay más pedidos con saldo para esta clienta."
          getKey={(o) => o.id}
          onSelectItem={(o) => addOrder(o)}
          renderItem={(o) => (
            <div className="flex w-full items-center justify-between">
              <div>
                <p className="font-mono text-xs font-medium">{o.orderNumber}</p>
                <p className="text-xs text-muted-foreground">
                  Saldo: S/ {o.balance}
                </p>
              </div>
              <Plus className="size-4 text-muted-foreground" />
            </div>
          )}
        />

        {applications.length > 0 ? (
          <div className="rounded-lg border border-border bg-card">
            {applications.map((a) => (
              <div
                key={a.orderId}
                className="flex items-center gap-2 border-b border-border px-3 py-2 last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate font-mono text-xs font-medium">
                    {a.orderNumber}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ORDER_STATUS_LABELS[a.balance] ?? `Saldo: S/ ${a.balance}`}
                  </p>
                </div>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={a.amount}
                  onChange={(e) => setAppAmount(a.orderId, e.target.value)}
                  className="h-8 w-28"
                />
                <button
                  type="button"
                  onClick={() => removeApp(a.orderId)}
                  className="text-destructive"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No hay pedidos aplicados. Usa el buscador para agregar.
          </p>
        )}

        <div className="flex justify-between rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Aplicado</span>
          <span>S/ {appliedSum.toFixed(2)}</span>
        </div>
        <div className="flex justify-between rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Restante</span>
          <span
            className={cn(
              remaining < -0.01 && "text-destructive",
              remaining > 0.01 && "text-amber-600",
            )}
          >
            S/ {remaining.toFixed(2)}
          </span>
        </div>
        {remaining < -0.01 ? (
          <p className="text-xs text-destructive">
            La suma aplicada supera el monto del pago.
          </p>
        ) : null}

        {state.message && !state.ok ? (
          <p className="rounded-md bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
            {state.message}
          </p>
        ) : null}
        {state.message && state.ok ? (
          <p className="rounded-md bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-700">
            {state.message}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={!canSubmit || !hasChanges || pending}
          variant="outline"
          className="w-full"
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Guardando…
            </>
          ) : (
            "Guardar aplicaciones"
          )}
        </Button>
        {!hasChanges && applications.length > 0 ? (
          <Badge variant="outline" className="self-start">Sin cambios</Badge>
        ) : null}
      </form>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirmar cambio de aplicaciones"
        description={
          <div className="flex flex-col gap-1 text-sm">
            <p>Se actualizarán las aplicaciones de este pago a los siguientes pedidos:</p>
            {applications.map((a) => (
              <p key={a.orderId}>
                <strong>{a.orderNumber}</strong>: S/ {a.amount}
              </p>
            ))}
            <p className="mt-1 text-xs text-muted-foreground">
              Los saldos de los pedidos solo se actualizan al validar el pago.
            </p>
          </div>
        }
        confirmLabel="Guardar cambios"
        pending={pending}
        onConfirm={handleConfirm}
      />
    </>
  );
}
