"use client";

import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/ui/submit-button";
import { FieldError } from "@/components/ui/field-error";
import { FormMessage } from "@/components/ui/form-message";
import { CancelLink } from "@/components/ui/cancel-link";
import {
  INCIDENT_DECISION_OPTIONS,
  INCIDENT_TYPE_OPTIONS,
  RETURN_DECISIONS,
  decisionRequiresVariant,
  decisionRequiresCredit,
} from "@/lib/incidents-shared";
import type { IncidentActionResult } from "@/actions/incidents";
import {
  createIncidentAction,
  searchOrdersForIncidentAction,
  searchVariantsForIncidentAction,
  searchCustomersForIncidentAction,
  getOrderItemsForOrderAction,
} from "@/actions/incidents";
import type { IncidentReturnDecision, IncidentType } from "@prisma/client";

type OrderHit = {
  id: string;
  orderNumber: string;
  status: string;
  total: string;
  customer: { id: string; name: string; whatsapp: string };
};

type VariantHit = {
  id: string;
  code: string;
  color: string | null;
  stock: number;
  soldStock: number;
  price: string;
  product: { id: string; name: string };
};

type CustomerHit = {
  id: string;
  name: string;
  whatsapp: string;
};

type OrderItemHit = {
  id: string;
  quantity: number;
  lineTotal: string;
  variant: {
    id: string;
    code: string;
    color: string | null;
    product: { id: string; name: string };
  };
};

const initialState: IncidentActionResult = { ok: false };

type Props = {
  cancelHref: string;
  prefill?: {
    orderId?: string;
    variantId?: string;
    customerId?: string;
  };
};

export function IncidentForm({ cancelHref, prefill }: Props) {
  const [state, formAction] = useActionState<IncidentActionResult, FormData>(
    createIncidentAction,
    initialState,
  );

  const [type, setType] = useState<IncidentType>("RETURN");
  const [decision, setDecision] =
    useState<IncidentReturnDecision>("RESTOCK");

  const [orderQuery, setOrderQuery] = useState("");
  const [orderResults, setOrderResults] = useState<OrderHit[]>([]);
  const [orderSearching, startOrderSearch] = useTransition();
  const [selectedOrder, setSelectedOrder] = useState<OrderHit | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItemHit[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>("");

  const [variantQuery, setVariantQuery] = useState("");
  const [variantResults, setVariantResults] = useState<VariantHit[]>([]);
  const [variantSearching, startVariantSearch] = useTransition();
  const [selectedVariant, setSelectedVariant] = useState<VariantHit | null>(null);

  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerHit[]>([]);
  const [customerSearching, startCustomerSearch] = useTransition();
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerHit | null>(null);

  useEffect(() => {
    if (!prefill) return;
    if (prefill.orderId) {
      const fetchOrder = async () => {
        try {
          const results = await searchOrdersForIncidentAction(prefill.orderId!);
          if (results[0]) {
            setSelectedOrder(results[0]);
            const items = await getOrderItemsForOrderAction(results[0].id);
            setOrderItems(items.items);
          }
        } catch {
          /* noop */
        }
      };
      void fetchOrder();
    }
    if (prefill.customerId) {
      const fetchCustomer = async () => {
        try {
          const results = await searchCustomersForIncidentAction(prefill.customerId!);
          if (results[0]) setSelectedCustomer(results[0]);
        } catch {
          /* noop */
        }
      };
      void fetchCustomer();
    }
  }, [prefill]);

  const orderDebounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const variantDebounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const customerDebounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  function onOrderSearch(value: string) {
    setOrderQuery(value);
    if (orderDebounceRef.current) clearTimeout(orderDebounceRef.current);
    if (value.trim().length < 2) {
      setOrderResults([]);
      return;
    }
    orderDebounceRef.current = setTimeout(() => {
      startOrderSearch(async () => {
        try {
          const results = await searchOrdersForIncidentAction(value);
          setOrderResults(results);
        } catch {
          setOrderResults([]);
        }
      });
    }, 300);
  }

  function onPickOrder(order: OrderHit) {
    setSelectedOrder(order);
    setOrderResults([]);
    setOrderQuery("");
    setSelectedItemId("");
    startOrderSearch(async () => {
      try {
        const items = await getOrderItemsForOrderAction(order.id);
        setOrderItems(items.items);
        if (items.items.length === 1) {
          const only = items.items[0];
          setSelectedItemId(only.id);
          setSelectedVariant({
            id: only.variant.id,
            code: only.variant.code,
            color: only.variant.color,
            stock: 0,
            soldStock: only.quantity,
            price: "0.00",
            product: only.variant.product,
          });
        }
      } catch {
        setOrderItems([]);
      }
    });
  }

  function onClearOrder() {
    setSelectedOrder(null);
    setOrderItems([]);
    setSelectedItemId("");
    setSelectedVariant(null);
  }

  function onPickVariant(variant: VariantHit) {
    setSelectedVariant(variant);
    setVariantResults([]);
    setVariantQuery("");
  }

  function onClearVariant() {
    setSelectedVariant(null);
  }

  function onPickItem(item: OrderItemHit) {
    setSelectedItemId(item.id);
    setSelectedVariant({
      id: item.variant.id,
      code: item.variant.code,
      color: item.variant.color,
      stock: 0,
      soldStock: item.quantity,
      price: "0.00",
      product: item.variant.product,
    });
  }

  function onVariantSearch(value: string) {
    setVariantQuery(value);
    if (variantDebounceRef.current) clearTimeout(variantDebounceRef.current);
    if (value.trim().length < 2) {
      setVariantResults([]);
      return;
    }
    variantDebounceRef.current = setTimeout(() => {
      startVariantSearch(async () => {
        try {
          const results = await searchVariantsForIncidentAction(value);
          setVariantResults(results);
        } catch {
          setVariantResults([]);
        }
      });
    }, 300);
  }

  function onCustomerSearch(value: string) {
    setCustomerQuery(value);
    if (customerDebounceRef.current) clearTimeout(customerDebounceRef.current);
    if (value.trim().length < 2) {
      setCustomerResults([]);
      return;
    }
    customerDebounceRef.current = setTimeout(() => {
      startCustomerSearch(async () => {
        try {
          const results = await searchCustomersForIncidentAction(value);
          setCustomerResults(results);
        } catch {
          setCustomerResults([]);
        }
      });
    }, 300);
  }

  function onPickCustomer(c: CustomerHit) {
    setSelectedCustomer(c);
    setCustomerResults([]);
    setCustomerQuery("");
  }

  function onClearCustomer() {
    setSelectedCustomer(null);
  }

  function onTypeChange(next: IncidentType) {
    setType(next);
    if (next === "RETURN") {
      if (decision === "NONE" || !decision) setDecision("RESTOCK");
    } else if (next === "DAMAGE" || next === "LOSS" || next === "CLAIM") {
      setDecision("NONE");
    } else if (next === "EXCHANGE") {
      setDecision("REPLACE");
    }
  }

  const showReturnDecisions = type === "RETURN";
  const requiresVariant =
    decisionRequiresVariant(decision) ||
    ((type === "DAMAGE" || type === "LOSS") && !selectedOrder);
  const requiresCustomer = decisionRequiresCredit(decision);
  const showOrderSection =
    type === "RETURN" || type === "EXCHANGE" || type === "CLAIM";

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informacion de la incidencia</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="incidentDate" className="text-sm font-medium">
              Fecha *
            </label>
            <Input
              id="incidentDate"
              name="incidentDate"
              type="date"
              required
              defaultValue={new Date().toISOString().split("T")[0]}
              aria-invalid={Boolean(state.fieldErrors?.incidentDate)}
            />
            <FieldError message={state.fieldErrors?.incidentDate} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="type" className="text-sm font-medium">
              Tipo *
            </label>
            <select
              id="type"
              name="type"
              required
              value={type}
              onChange={(e) => onTypeChange(e.target.value as IncidentType)}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {INCIDENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <FieldError message={state.fieldErrors?.type} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="decision" className="text-sm font-medium">
              Decision
            </label>
            <select
              id="decision"
              name="decision"
              value={decision}
              onChange={(e) =>
                setDecision(e.target.value as IncidentReturnDecision)
              }
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {showReturnDecisions
                ? INCIDENT_DECISION_OPTIONS.filter((o) =>
                    RETURN_DECISIONS.includes(o.value),
                  ).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))
                : INCIDENT_DECISION_OPTIONS.filter((o) => o.value === "NONE").map(
                    (opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ),
                  )}
            </select>
            <p className="text-xs text-muted-foreground">
              {showReturnDecisions
                ? "Define que se hace con la mercaderia devuelta."
                : "Dano, perdida, reclamo y cambio no requieren decision de devolucion."}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="quantity" className="text-sm font-medium">
              Cantidad *
            </label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              step="1"
              min="1"
              max="100000"
              required
              defaultValue="1"
              aria-invalid={Boolean(state.fieldErrors?.quantity)}
            />
            <FieldError message={state.fieldErrors?.quantity} />
          </div>

          {decision === "RESTOCK" && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="restockQuantity" className="text-sm font-medium">
                Cantidad a volver a stock *
              </label>
              <Input
                id="restockQuantity"
                name="restockQuantity"
                type="number"
                step="1"
                min="1"
                max="100000"
                required
                placeholder="Igual o menor a la cantidad"
                aria-invalid={Boolean(state.fieldErrors?.restockQuantity)}
              />
              <FieldError message={state.fieldErrors?.restockQuantity} />
            </div>
          )}

          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label htmlFor="description" className="text-sm font-medium">
              Detalle *
            </label>
            <Input
              id="description"
              name="description"
              required
              maxLength={500}
              placeholder="Describe brevemente la incidencia"
              aria-invalid={Boolean(state.fieldErrors?.description)}
            />
            <FieldError message={state.fieldErrors?.description} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="lostAmount" className="text-sm font-medium">
              Monto perdido (S/)
            </label>
            <Input
              id="lostAmount"
              name="lostAmount"
              type="number"
              step="0.01"
              min="0"
              defaultValue="0"
              placeholder="0.00"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="recoveredAmount" className="text-sm font-medium">
              Monto recuperado (S/)
            </label>
            <Input
              id="recoveredAmount"
              name="recoveredAmount"
              type="number"
              step="0.01"
              min="0"
              defaultValue="0"
              placeholder="0.00"
            />
          </div>
        </CardContent>
      </Card>

      {showOrderSection && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pedido asociado</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {selectedOrder ? (
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-sm font-medium">
                      {selectedOrder.orderNumber}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedOrder.customer.name} · Total S/{" "}
                      {Number(selectedOrder.total).toFixed(2)} ·{" "}
                      {selectedOrder.status}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClearOrder}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    Quitar
                  </button>
                </div>
                <input
                  type="hidden"
                  name="orderId"
                  value={selectedOrder.id}
                />
                {orderItems.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="orderItemId"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Linea de pedido
                    </label>
                    <select
                      id="orderItemId"
                      name="orderItemId"
                      value={selectedItemId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setSelectedItemId(id);
                        const it = orderItems.find((i) => i.id === id);
                        if (it) onPickItem(it);
                      }}
                      className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                    >
                      <option value="">Sin linea especifica</option>
                      {orderItems.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.variant.product.name}
                          {it.variant.color ? ` (${it.variant.color})` : ""} ·{" "}
                          {it.quantity} uds · S/{" "}
                          {Number(it.lineTotal).toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative">
                <Input
                  value={orderQuery}
                  onChange={(e) => onOrderSearch(e.target.value)}
                  placeholder="Buscar pedido por numero, clienta o WhatsApp…"
                />
                {orderResults.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-card shadow-lg">
                    {orderResults.map((o) => (
                      <li
                        key={o.id}
                        className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm hover:bg-accent"
                        onClick={() => onPickOrder(o)}
                      >
                        <div>
                          <span className="font-mono text-xs text-muted-foreground">
                            {o.orderNumber}
                          </span>
                          <span className="ml-2">{o.customer.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          S/ {Number(o.total).toFixed(2)} · {o.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {orderSearching && (
                  <p className="mt-1 text-xs text-muted-foreground">Buscando…</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {requiresVariant && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Producto / Variante</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {selectedVariant ? (
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                <div>
                  <p className="text-sm font-medium">
                    {selectedVariant.product.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedVariant.code}
                    {selectedVariant.color ? ` · ${selectedVariant.color}` : ""}
                    {type !== "RETURN" || decision !== "RESTOCK"
                      ? ` · Stock ${selectedVariant.stock} · Vendido ${selectedVariant.soldStock}`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClearVariant}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Quitar
                </button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  value={variantQuery}
                  onChange={(e) => onVariantSearch(e.target.value)}
                  placeholder="Buscar por SKU, nombre o color…"
                />
                {variantResults.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-card shadow-lg">
                    {variantResults.map((v) => (
                      <li
                        key={v.id}
                        className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm hover:bg-accent"
                        onClick={() => onPickVariant(v)}
                      >
                        <div>
                          <span className="font-mono text-xs text-muted-foreground">
                            {v.code}
                          </span>
                          <span className="ml-2">{v.product.name}</span>
                          {v.color ? (
                            <span className="ml-1 text-muted-foreground">
                              ({v.color})
                            </span>
                          ) : null}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Stock {v.stock} · S/ {Number(v.price).toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {variantSearching && (
                  <p className="mt-1 text-xs text-muted-foreground">Buscando…</p>
                )}
              </div>
            )}
            <input
              type="hidden"
              name="variantId"
              value={selectedVariant?.id ?? ""}
            />
            <FieldError message={state.fieldErrors?.variantId} />
          </CardContent>
        </Card>
      )}

      {(requiresCustomer || type === "RETURN" || type === "CLAIM") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clienta</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {selectedCustomer ? (
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                <div>
                  <p className="text-sm font-medium">{selectedCustomer.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedCustomer.whatsapp}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClearCustomer}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Quitar
                </button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  value={customerQuery}
                  onChange={(e) => onCustomerSearch(e.target.value)}
                  placeholder="Buscar por nombre o WhatsApp…"
                />
                {customerResults.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-card shadow-lg">
                    {customerResults.map((c) => (
                      <li
                        key={c.id}
                        className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm hover:bg-accent"
                        onClick={() => onPickCustomer(c)}
                      >
                        <span>{c.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {c.whatsapp}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {customerSearching && (
                  <p className="mt-1 text-xs text-muted-foreground">Buscando…</p>
                )}
              </div>
            )}
            <input
              type="hidden"
              name="customerId"
              value={selectedCustomer?.id ?? ""}
            />
            <FieldError message={state.fieldErrors?.customerId} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notas</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            id="notes"
            name="notes"
            rows={3}
            maxLength={1000}
            placeholder="Notas adicionales (opcional)"
          />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <FormMessage ok={state.ok} message={state.message} />
        <div className="flex items-center gap-2">
          <CancelLink href={cancelHref} />
          <SubmitButton label="Registrar incidencia" />
        </div>
      </div>
    </form>
  );
}
