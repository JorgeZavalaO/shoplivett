"use client";

import { useActionState, useCallback, useMemo, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AsyncSearchList } from "@/components/ui/async-search-list";
import { formatWhatsAppDisplay } from "@/lib/phone";
import { PAYMENT_METHOD_LABELS } from "@/lib/settings-defaults";
import { cn } from "@/lib/utils";
import {
  createPaymentAction,
  searchCustomersForPaymentAction,
  searchOrdersForPaymentAction,
  type PaymentActionResult,
} from "@/actions/payments";

const initialState: PaymentActionResult = { ok: false };

type Customer = { id: string; name: string; whatsapp: string };
type OrderOption = {
  id: string;
  orderNumber: string;
  total: string;
  balance: string;
  status: string;
};

type Props = {
  enabledMethods: ("YAPE" | "PLIN" | "CASH" | "OTHER")[];
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Guardando…
        </>
      ) : (
        "Registrar pago"
      )}
    </Button>
  );
}

export function CreatePaymentForm({ enabledMethods }: Props) {
  const router = useRouter();
  const [state, formAction] = useActionState<PaymentActionResult, FormData>(
    createPaymentAction,
    initialState,
  );

  const [customerQuery, setCustomerQuery] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [, searchCustomer] = useTransition();
  const searchCust = useCallback(
    async (q: string) => {
      setCustomerQuery(q);
      if (q.length < 2) {
        setCustomerResults([]);
        setCustomerError(null);
        return;
      }
      setCustomerLoading(true);
      setCustomerError(null);
      searchCustomer(async () => {
        try {
          const res = await searchCustomersForPaymentAction(q);
          setCustomerResults(res);
        } catch (err) {
          console.error(err);
          setCustomerError("No pudimos buscar clientas. Intenta nuevamente.");
          setCustomerResults([]);
        } finally {
          setCustomerLoading(false);
        }
      });
    },
    [searchCustomer],
  );

  const [orderQuery, setOrderQuery] = useState("");
  const [orderResults, setOrderResults] = useState<OrderOption[]>([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [, searchOrders] = useTransition();
  const searchOrd = useCallback(
    async (q: string) => {
      setOrderQuery(q);
      if (!customerId) {
        setOrderResults([]);
        setOrderError(null);
        return;
      }
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

  const [applications, setApplications] = useState<
    { orderId: string; orderNumber: string; balance: string; amount: string }[]
  >([]);
  const [method, setMethod] = useState(enabledMethods[0] ?? "YAPE");
  const [amount, setAmount] = useState("");

  const appliedSum = useMemo(
    () => applications.reduce((acc, a) => acc + (Number(a.amount) || 0), 0),
    [applications],
  );
  const amountNum = Number(amount) || 0;
  const remaining = amountNum - appliedSum;

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

  const appsJson = useMemo(
    () => JSON.stringify(applications.map((a) => ({ orderId: a.orderId, amount: a.amount }))),
    [applications],
  );

  const canSubmit = customerId && amountNum > 0 && applications.length > 0;

  return (
    <form action={formAction} className="flex flex-col gap-4 lg:flex-row" noValidate>
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="applications" value={appsJson} />

      <div className="flex flex-1 flex-col gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Clienta</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {customerName ? (
              <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{customerName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatWhatsAppDisplay(customerResults.find((c) => c.id === customerId)?.whatsapp ?? "")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCustomerId("");
                    setCustomerName("");
                    setCustomerQuery("");
                    setApplications([]);
                  }}
                  className="text-destructive"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <AsyncSearchList
                value={customerQuery}
                onValueChange={setCustomerQuery}
                onSearch={(q) => void searchCust(q)}
                isLoading={customerLoading}
                isQueryTooShort={customerQuery.length > 0 && customerQuery.length < 2}
                results={customerResults}
                errorMessage={customerError}
                placeholder="Buscar clienta por nombre o WhatsApp…"
                emptyMessage="Empieza a escribir (2 letras) para buscar."
                noResultsMessage="No encontramos clientas con ese criterio."
                getKey={(c) => c.id}
                onSelectItem={(c) => {
                  setCustomerId(c.id);
                  setCustomerName(c.name);
                  setCustomerQuery("");
                  setCustomerResults([]);
                }}
                renderItem={(c) => (
                  <>
                    <span className="font-medium">{c.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {formatWhatsAppDisplay(c.whatsapp)}
                    </span>
                  </>
                )}
              />
            )}
            {state.fieldErrors?.customerId ? (
              <p className="text-xs text-destructive">{state.fieldErrors.customerId}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pedidos a aplicar</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {!customerId ? (
              <p className="text-xs text-muted-foreground">
                Selecciona una clienta para ver sus pedidos con saldo pendiente.
              </p>
            ) : (
              <AsyncSearchList
                value={orderQuery}
                onValueChange={setOrderQuery}
                onSearch={(q) => void searchOrd(q)}
                isLoading={orderLoading}
                isQueryTooShort={orderQuery.length > 0 && orderQuery.length < 2}
                results={orderResults.filter(
                  (o) => !applications.some((a) => a.orderId === o.id),
                )}
                errorMessage={orderError}
                placeholder="Buscar pedido por número…"
                emptyMessage="Empieza a escribir (2 letras) para buscar pedidos."
                noResultsMessage="No hay pedidos con saldo para esta clienta."
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
            )}

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
                        Saldo: S/ {a.balance}
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
            ) : null}
            {state.fieldErrors?.applications ? (
              <p className="text-xs text-destructive">{state.fieldErrors.applications}</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="flex w-full shrink-0 flex-col gap-4 lg:w-80">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Datos del pago</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Método de pago</label>
              <select
                name="method"
                value={method}
                onChange={(e) => setMethod(e.target.value as typeof method)}
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
              >
                {enabledMethods.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Monto *</label>
              <Input
                name="amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
              {state.fieldErrors?.amount ? (
                <p className="text-xs text-destructive">{state.fieldErrors.amount}</p>
              ) : null}
            </div>

            <div className="flex justify-between rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Aplicado</span>
              <span>S/ {appliedSum.toFixed(2)}</span>
            </div>
            <div className="flex justify-between rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Restante</span>
              <span
                className={cn(
                  remaining < 0 && "text-destructive",
                  remaining > 0 && "text-amber-600",
                )}
              >
                S/ {remaining.toFixed(2)}
              </span>
            </div>
            {remaining < 0 ? (
              <p className="text-xs text-destructive">
                La suma aplicada supera el monto del pago.
              </p>
            ) : null}

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">N° de operación</label>
              <Input name="operationNumber" placeholder="opcional" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Notas</label>
              <textarea
                name="notes"
                rows={2}
                maxLength={1000}
                className="min-h-12 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Capturas (opcional, varias)</label>
              <input
                type="file"
                name="receipts"
                multiple
                accept="image/png,image/jpeg,image/webp"
                className="text-xs"
              />
            </div>

            {state.message && !state.ok ? (
              <p className="rounded-md bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
                {state.message}
              </p>
            ) : null}

            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/pagos")}
              >
                Cancelar
              </Button>
              <SubmitButton />
            </div>
            {!canSubmit ? (
              <p className="text-xs text-muted-foreground">
                Completa clienta, monto y al menos un pedido aplicado.
              </p>
            ) : (
              <Badge variant="outline" className="self-start">Listo para registrar</Badge>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="mt-2 text-xs text-muted-foreground lg:hidden">
        <Link href="/pagos" className="underline">Volver al listado</Link>
      </p>
    </form>
  );
}
