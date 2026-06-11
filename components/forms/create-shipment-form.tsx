"use client";

import { useActionState, useCallback, useMemo, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { formatWhatsAppDisplay } from "@/lib/phone";
import { SHIPPING_METHOD_LABELS } from "@/lib/settings-defaults";
import { cn } from "@/lib/utils";
import {
  createShipmentAction,
  getEligibleOrdersForShipmentAction,
  searchCustomersForShipmentAction,
  type ShipmentActionResult,
} from "@/actions/shipments";

const initialState: ShipmentActionResult = { ok: false };

type Customer = { id: string; name: string; whatsapp: string };
type OrderOption = {
  id: string;
  orderNumber: string;
  total: string;
  balance: string;
  status: string;
  createdAt: Date;
};
type PickedOrder = { id: string; orderNumber: string; total: string };

type ShippingMethod = "DELIVERY_PROPIO" | "OLVA" | "SHALOM" | "MOTORIZADO" | "RECOJO";

type Props = {
  enabledShippingMethods: ShippingMethod[];
  freeShippingEnabled: boolean;
  freeShippingThreshold: string;
  defaultCustomer?: Customer | null;
  preselectOrder?: {
    id: string;
    orderNumber: string;
    total: string;
  } | null;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Creando…
        </>
      ) : (
        "Crear envío"
      )}
    </Button>
  );
}

export function CreateShipmentForm({
  enabledShippingMethods,
  freeShippingEnabled,
  freeShippingThreshold,
  defaultCustomer,
  preselectOrder,
}: Props) {
  const router = useRouter();
  const [state, formAction] = useActionState<ShipmentActionResult, FormData>(
    createShipmentAction,
    initialState,
  );

  const [customerQuery, setCustomerQuery] = useState("");
  const [customerId, setCustomerId] = useState(defaultCustomer?.id ?? "");
  const [customerName, setCustomerName] = useState(defaultCustomer?.name ?? "");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [, searchCustomer] = useTransition();
  const searchCust = useCallback(
    (q: string) => {
      setCustomerQuery(q);
      if (q.length < 2) {
        setCustomerResults([]);
        return;
      }
      searchCustomer(async () => {
        const res = await searchCustomersForShipmentAction(q);
        setCustomerResults(res);
      });
    },
    [searchCustomer],
  );

  const [orderQuery, setOrderQuery] = useState("");
  const [orderResults, setOrderResults] = useState<OrderOption[]>([]);
  const [, searchOrders] = useTransition();
  const searchOrd = useCallback(
    (q: string) => {
      setOrderQuery(q);
      if (!customerId) {
        setOrderResults([]);
        return;
      }
      searchOrders(async () => {
        const res = await getEligibleOrdersForShipmentAction(customerId, q);
        setOrderResults(res);
      });
    },
    [customerId, searchOrders],
  );

  const [picked, setPicked] = useState<PickedOrder[]>(
    preselectOrder
      ? [
          {
            id: preselectOrder.id,
            orderNumber: preselectOrder.orderNumber,
            total: preselectOrder.total,
          },
        ]
      : [],
  );
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>(
    enabledShippingMethods[0] ?? "DELIVERY_PROPIO",
  );
  const [shippingCost, setShippingCost] = useState("0");
  const [forceFree, setForceFree] = useState(false);
  const [agencyName, setAgencyName] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [address, setAddress] = useState("");
  const [district, setDistrict] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const totalCents = useMemo(
    () => picked.reduce((acc, o) => acc + Math.round(Number(o.total) * 100), 0),
    [picked],
  );
  const thresholdCents = Math.round(Number(freeShippingThreshold) * 100);
  const autoFree =
    freeShippingEnabled && thresholdCents > 0 && totalCents >= thresholdCents;
  const isFree = forceFree || autoFree;
  const finalCost = isFree ? 0 : Number(shippingCost) || 0;

  const ordersJson = useMemo(
    () => JSON.stringify(picked.map((o) => o.id)),
    [picked],
  );

  function addOrder(o: OrderOption) {
    if (picked.some((p) => p.id === o.id)) return;
    setPicked((prev) => [
      ...prev,
      { id: o.id, orderNumber: o.orderNumber, total: o.total },
    ]);
    setOrderQuery("");
    setOrderResults([]);
  }
  function removePicked(id: string) {
    setPicked((prev) => prev.filter((p) => p.id !== id));
  }

  const canSubmit = customerId && picked.length > 0;

  return (
    <form action={formAction} className="flex flex-col gap-4 lg:flex-row" noValidate>
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="orderIds" value={ordersJson} />
      <input
        type="hidden"
        name="forceFreeShipping"
        value={forceFree ? "true" : "false"}
      />
      <input type="hidden" name="shippingCost" value={shippingCost} />

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
                    {formatWhatsAppDisplay(
                      customerResults.find((c) => c.id === customerId)?.whatsapp ??
                        defaultCustomer?.whatsapp ??
                        "",
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCustomerId("");
                    setCustomerName("");
                    setCustomerQuery("");
                    setCustomerResults([]);
                    setPicked([]);
                  }}
                  className="text-destructive"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar clienta por nombre o WhatsApp…"
                    className="pl-9"
                    value={customerQuery}
                    onChange={(e) => searchCust(e.target.value)}
                  />
                </div>
                {customerResults.length > 0 ? (
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-card">
                    {customerResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => {
                          setCustomerId(c.id);
                          setCustomerName(c.name);
                          setCustomerQuery("");
                          setCustomerResults([]);
                          setPicked([]);
                        }}
                      >
                        <span className="font-medium">{c.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {formatWhatsAppDisplay(c.whatsapp)}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            )}
            {state.fieldErrors?.customerId ? (
              <p className="text-xs text-destructive">{state.fieldErrors.customerId}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pedidos a incluir</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {!customerId ? (
              <p className="text-xs text-muted-foreground">
                Selecciona una clienta para listar sus pedidos pagados.
              </p>
            ) : (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar pedido por número…"
                    className="pl-9"
                    value={orderQuery}
                    onChange={(e) => searchOrd(e.target.value)}
                  />
                </div>
                {orderResults.length > 0 ? (
                  <div className="max-h-60 overflow-y-auto rounded-lg border border-border bg-card">
                    {orderResults
                      .filter((o) => !picked.some((p) => p.id === o.id))
                      .map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                          onClick={() => addOrder(o)}
                        >
                          <div>
                            <p className="font-mono text-xs font-medium">{o.orderNumber}</p>
                            <p className="text-xs text-muted-foreground">
                              Total: S/ {o.total}
                            </p>
                          </div>
                          <Plus className="size-4 text-muted-foreground" />
                        </button>
                      ))}
                  </div>
                ) : null}
              </>
            )}

            {picked.length > 0 ? (
              <div className="rounded-lg border border-border bg-card">
                {picked.map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center gap-2 border-b border-border px-3 py-2 last:border-b-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-mono text-xs font-medium">
                        {o.orderNumber}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Total: S/ {o.total}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removePicked(o.id)}
                      className="text-destructive"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            {state.fieldErrors?.orderIds ? (
              <p className="text-xs text-destructive">{state.fieldErrors.orderIds}</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="flex w-full shrink-0 flex-col gap-4 lg:w-96">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Datos del envío</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Método de envío</label>
              <select
                name="shippingMethod"
                value={shippingMethod}
                onChange={(e) => setShippingMethod(e.target.value as ShippingMethod)}
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
              >
                {enabledShippingMethods.map((m) => (
                  <option key={m} value={m}>
                    {SHIPPING_METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Costo de envío</label>
              <Input
                type="text"
                inputMode="decimal"
                value={shippingCost}
                onChange={(e) => setShippingCost(e.target.value || "0")}
                placeholder="0.00"
                disabled={isFree}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={forceFree}
                  onChange={(e) => setForceFree(e.target.checked)}
                />
                Forzar envío gratis
              </label>
            </div>

            <div className="rounded-md border border-border bg-muted/20 p-2 text-xs">
              <p>
                Total pedidos: <strong>S/ {(totalCents / 100).toFixed(2)}</strong>
              </p>
              {freeShippingEnabled ? (
                <p>
                  Umbral gratis: S/ {freeShippingThreshold}
                </p>
              ) : null}
              {autoFree && !forceFree ? (
                <p className="text-emerald-600">Envío gratis automático por umbral.</p>
              ) : null}
              {isFree ? (
                <Badge variant="outline" className="mt-1 border-emerald-600 text-emerald-700">
                  Gratis
                </Badge>
              ) : null}
            </div>

            <div className="flex justify-between rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Costo final</span>
              <span className={cn(isFree && "text-emerald-600 font-medium")}>
                S/ {finalCost.toFixed(2)}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Agencia</label>
              <Input
                name="agencyName"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="Olva, Shalom, etc."
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Tracking</label>
              <Input
                name="trackingCode"
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
                placeholder="opcional"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Dirección</label>
              <Input
                name="addressSnapshot"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Si la difieres de la de la clienta"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Distrito</label>
              <Input
                name="districtSnapshot"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Referencia</label>
              <Textarea
                name="referenceSnapshot"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                rows={2}
                maxLength={500}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Notas</label>
              <Textarea
                name="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                maxLength={1000}
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
                onClick={() => router.push("/envios")}
              >
                Cancelar
              </Button>
              <SubmitButton />
            </div>
            {!canSubmit ? (
              <p className="text-xs text-muted-foreground">
                Completa clienta y al menos un pedido para crear el envío.
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              <Link href="/envios" className="underline">
                Volver al listado
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
