"use client";

import { useActionState, useCallback, useMemo, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Calculator, Loader2, Minus, Plus, ShoppingCart, UserPlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AsyncSearchList } from "@/components/ui/async-search-list";
import { MarginBadge } from "@/components/financial/margin-badge";
import { StockHealthBadge } from "@/components/financial/stock-health-badge";
import { formatWhatsAppDisplay } from "@/lib/phone";
import { isBelowMinimumPrice } from "@/lib/financial-ui";
import {
  createQuickSaleAction,
  searchVariantsForSaleAction,
  searchCustomersForSaleAction,
  type VariantSearchResult,
  type OrderActionResult,
} from "@/actions/sales";

const initialState: OrderActionResult = { ok: false };

type CartItem = {
  variantId: string;
  code: string;
  name: string;
  color: string | null;
  quantity: number;
  unitPrice: string;
  max: number;
  unitRealCost?: string | null;
  minimumPrice?: string | null;
  suggestedPrice?: string | null;
  currentMarginPercent?: number | null;
  costSource?: "BATCH" | "LEGACY" | "NONE";
};

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} className="w-full text-base">
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Creando pedido…
        </>
      ) : (
        "Crear pedido"
      )}
    </Button>
  );
}

type Props = {
  openLive?: { id: string; name: string } | null;
  enabledPaymentMethods: ("YAPE" | "PLIN" | "CASH" | "OTHER")[];
  salesChannelOptions: { value: string; label: string }[];
};

export function QuickSaleForm({ openLive, enabledPaymentMethods, salesChannelOptions }: Props) {
  const [state, formAction] = useActionState<OrderActionResult, FormData>(
    createQuickSaleAction,
    initialState,
  );

  // --- Customer ---
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerResults, setCustomerResults] = useState<{ id: string; name: string; whatsapp: string }[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [, searchCustomer] = useTransition();
  const searchCust = useCallback(async (q: string) => {
    setCustomerQuery(q);
    if (q.length < 2) { setCustomerResults([]); setCustomerError(null); return; }
    setCustomerLoading(true);
    setCustomerError(null);
    searchCustomer(async () => {
      try {
        const res = await searchCustomersForSaleAction(q);
        setCustomerResults(res);
      } catch (err) {
        console.error(err);
        setCustomerError("No pudimos buscar clientas. Intenta nuevamente.");
        setCustomerResults([]);
      } finally {
        setCustomerLoading(false);
      }
    });
  }, []);

  // --- Variant search ---
  const [variantQuery, setVariantQuery] = useState("");
  const [variantResults, setVariantResults] = useState<VariantSearchResult[]>([]);
  const [variantLoading, setVariantLoading] = useState(false);
  const [variantError, setVariantError] = useState<string | null>(null);
  const [, searchVariant] = useTransition();
  const searchVar = useCallback(async (q: string) => {
    setVariantQuery(q);
    if (q.length < 2) { setVariantResults([]); setVariantError(null); return; }
    setVariantLoading(true);
    setVariantError(null);
    searchVariant(async () => {
      try {
        const res = await searchVariantsForSaleAction(q);
        setVariantResults(res);
      } catch (err) {
        console.error(err);
        setVariantError("No pudimos buscar productos. Intenta nuevamente.");
        setVariantResults([]);
      } finally {
        setVariantLoading(false);
      }
    });
  }, []);

  // --- Cart ---
  const [cart, setCart] = useState<CartItem[]>([]);
  const addToCart = (v: VariantSearchResult) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.variantId === v.id);
      if (existing) {
        const newQty = Math.min(existing.quantity + 1, existing.max);
        return prev.map((c) => c.variantId === v.id ? { ...c, quantity: newQty } : c);
      }
      return [...prev, {
        variantId: v.id,
        code: v.code,
        name: `${v.productName}${v.color ? ` · ${v.color}` : ""}`,
        color: v.color,
        quantity: 1,
        unitPrice: v.price,
        max: v.available,
        unitRealCost: v.unitRealCost ?? null,
        minimumPrice: v.minimumPrice ?? null,
        suggestedPrice: v.suggestedPrice ?? null,
        currentMarginPercent: v.currentMarginPercent ?? null,
        costSource: v.costSource ?? "NONE",
      }];
    });
    setVariantQuery("");
    setVariantResults([]);
  };
  const updateQty = (variantId: string, delta: number) => {
    setCart((prev) => prev.map((c) => {
      if (c.variantId !== variantId) return c;
      const next = Math.max(0, Math.min(c.quantity + delta, c.max));
      return next === 0 ? null as unknown as CartItem : { ...c, quantity: next };
    }).filter(Boolean));
  };
  const removeItem = (variantId: string) => setCart((prev) => prev.filter((c) => c.variantId !== variantId));

  // --- Totals ---
  const [discount, setDiscount] = useState("0");
  const [shippingAmount, setShippingAmount] = useState("0");
  const [advanceAmount, setAdvanceAmount] = useState("");

  const totals = useMemo(() => {
    const subtotal = cart.reduce((s, c) => s + Number(c.unitPrice) * c.quantity, 0);
    const d = Number(discount) || 0;
    const s2 = Number(shippingAmount) || 0;
    return { subtotal: subtotal.toFixed(2), total: Math.max(0, subtotal - d + s2).toFixed(2) };
  }, [cart, discount, shippingAmount]);

  // --- Payment method ---
  const [paymentMethod, setPaymentMethod] = useState(enabledPaymentMethods[0] ?? "YAPE");
  const [operationNumber, setOperationNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [salesChannel, setSalesChannel] = useState(
    salesChannelOptions[0]?.value ?? "WHATSAPP_DIRECTO",
  );

  const canSubmit = Boolean(
    customerId && cart.length > 0 && advanceAmount && Number(advanceAmount) > 0,
  );
  const cartFinancials = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);
    const discountValue = Number(discount) || 0;
    return cart.map((item) => {
      const lineSubtotal = Number(item.unitPrice) * item.quantity;
      const discountShare = subtotal > 0 ? (discountValue * lineSubtotal) / subtotal : 0;
      const effectiveLineTotal = Math.max(0, lineSubtotal - discountShare);
      const effectiveUnitPrice = item.quantity > 0 ? effectiveLineTotal / item.quantity : 0;
      const minimumPrice = Number(item.minimumPrice ?? "0") || 0;
      return {
        variantId: item.variantId,
        effectiveUnitPrice,
        effectiveLineTotal,
        minimumPrice,
        isBelowMinimum: isBelowMinimumPrice({ effectiveUnitPrice, minimumPrice }),
      };
    });
  }, [cart, discount]);
  const belowMinimumWarnings = cartFinancials.filter((item) => item.isBelowMinimum);

  return (
    <form action={formAction} className="flex flex-col gap-4 lg:flex-row" noValidate>
      {/* Hidden fields */}
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="liveSessionId" value={openLive?.id ?? ""} />
      <input type="hidden" name="items" value={JSON.stringify(cart.map((c) => ({ variantId: c.variantId, quantity: c.quantity })))} />
      <input type="hidden" name="discount" value={discount} />
      <input type="hidden" name="shippingAmount" value={shippingAmount} />
      <input type="hidden" name="advanceAmount" value={advanceAmount} />
      <input type="hidden" name="paymentMethod" value={paymentMethod} />
      <input type="hidden" name="operationNumber" value={operationNumber} />
      <input type="hidden" name="notes" value={notes} />
      <input type="hidden" name="salesChannel" value={salesChannel} />

      {/* Left: search + cart */}
      <div className="flex flex-1 flex-col gap-4">
        {/* Live */}
        {openLive ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Live activo: <span className="font-medium">{openLive.name}</span>
          </div>
        ) : (
          <div className="rounded-lg border border-muted bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            El pedido se registrará sin live asociado.
          </div>
        )}

        {/* Customer */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Clienta *</label>
          {customerName ? (
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
              <div>
                <p className="text-sm font-medium">{customerName}</p>
                <p className="text-xs text-muted-foreground">{formatWhatsAppDisplay("")}</p>
              </div>
              <button type="button" onClick={() => { setCustomerId(""); setCustomerName(""); setCustomerQuery(""); }} className="text-destructive">
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
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
              <Button
                variant="ghost"
                size="sm"
                className="w-fit"
                render={<Link href="/clientes/nuevo"><UserPlus className="size-4" /> Nueva clienta</Link>}
              />
            </div>
          )}
          {state.fieldErrors?.customerId ? (
            <p className="text-xs text-destructive">{state.fieldErrors.customerId}</p>
          ) : null}
        </div>

        {/* Variant search */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Agregar productos</label>
          <AsyncSearchList
            value={variantQuery}
            onValueChange={setVariantQuery}
            onSearch={(q) => void searchVar(q)}
            isLoading={variantLoading}
            isQueryTooShort={variantQuery.length > 0 && variantQuery.length < 2}
            results={variantResults}
            errorMessage={variantError}
            placeholder="Buscar por código, nombre o color…"
            emptyMessage="Empieza a escribir (2 letras) para buscar productos."
            noResultsMessage="No encontramos productos disponibles con ese criterio."
            getKey={(v) => v.id}
            onSelectItem={(v) => addToCart(v)}
            renderItem={(v) => (
              <div className="flex w-full items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{v.productName}</p>
                  <p className="text-xs text-muted-foreground">
                    {v.code} · {v.color || "—"} · S/ {v.price}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <StockHealthBadge availableUnits={v.available} />
                    {typeof v.currentMarginPercent === "number" ? (
                      <MarginBadge percent={v.currentMarginPercent} />
                    ) : null}
                    <Badge variant="secondary" className="shrink-0">{v.categoryName}</Badge>
                  </div>
                  {v.minimumPrice ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Mín. S/ {v.minimumPrice}
                      {v.suggestedPrice ? ` · Sug. S/ ${v.suggestedPrice}` : ""}
                    </p>
                  ) : null}
                </div>
              </div>
            )}
          />
          {state.fieldErrors?.items ? (
            <p className="text-xs text-destructive">{state.fieldErrors.items}</p>
          ) : null}
        </div>

        {/* Cart */}
        {cart.length === 0 ? (
          <Card className="border-dashed bg-muted/20">
            <CardContent className="flex flex-col items-center gap-2 py-8">
              <ShoppingCart className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Tu carrito está vacío. Busca productos para agregarlos.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-3 py-2">
              <p className="text-sm font-medium">Carrito ({cart.length})</p>
            </div>
            {cart.map((item) => (
              <div key={item.variantId} className="flex items-start gap-2 border-b border-border px-3 py-2 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.code} · S/ {item.unitPrice}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <StockHealthBadge availableUnits={item.max - item.quantity} />
                    {typeof item.currentMarginPercent === "number" ? (
                      <MarginBadge percent={item.currentMarginPercent} />
                    ) : null}
                  </div>
                  {item.minimumPrice ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Mín. S/ {item.minimumPrice}
                      {item.suggestedPrice ? ` · Sug. S/ ${item.suggestedPrice}` : ""}
                    </p>
                  ) : null}
                  {belowMinimumWarnings.some((warning) => warning.variantId === item.variantId) ? (
                    <p className="mt-1 text-[11px] font-medium text-destructive">
                      El descuento deja esta línea por debajo del precio mínimo.
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => updateQty(item.variantId, -1)} className="rounded p-0.5 hover:bg-muted">
                    <Minus className="size-3" />
                  </button>
                  <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                  <button type="button" onClick={() => updateQty(item.variantId, 1)} disabled={item.quantity >= item.max} className="rounded p-0.5 hover:bg-muted disabled:opacity-50">
                    <Plus className="size-3" />
                  </button>
                </div>
                <button type="button" onClick={() => removeItem(item.variantId)} className="ml-1 rounded p-0.5 text-destructive hover:bg-destructive/10">
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: summary */}
      <div className="flex w-full shrink-0 flex-col gap-4 lg:w-80">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="size-4" /> Resumen
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>S/ {totals.subtotal}</span>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="discount" className="text-xs text-muted-foreground">Descuento</label>
              <Input
                id="discount"
                type="text"
                inputMode="decimal"
                value={discount}
                onChange={(e) => setDiscount(e.target.value || "0")}
                placeholder="0.00"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="shipping" className="text-xs text-muted-foreground">Envío</label>
              <Input
                id="shipping"
                type="text"
                inputMode="decimal"
                value={shippingAmount}
                onChange={(e) => setShippingAmount(e.target.value || "0")}
                placeholder="0.00"
              />
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-sm font-semibold">
              <span>Total</span>
              <span>S/ {totals.total}</span>
            </div>

            {belowMinimumWarnings.length > 0 ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                <p className="font-medium">Venta por debajo del precio mínimo</p>
                <ul className="mt-1 space-y-1">
                  {belowMinimumWarnings.map((warning) => {
                    const item = cart.find((cartItem) => cartItem.variantId === warning.variantId);
                    if (!item) return null;
                    return (
                      <li key={warning.variantId}>
                        {item.name}: efectiva S/ {warning.effectiveUnitPrice.toFixed(2)} · mín. S/ {warning.minimumPrice.toFixed(2)}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <div className="flex flex-col gap-1">
              <label htmlFor="advance" className="text-xs font-medium text-muted-foreground">
                Adelanto *
              </label>
              <Input
                id="advance"
                type="text"
                inputMode="decimal"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                placeholder="0.00"
                required
              />
              {state.fieldErrors?.advanceAmount ? (
                <p className="text-xs text-destructive">{state.fieldErrors.advanceAmount}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Método de pago</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
              >
                {enabledPaymentMethods.map((m) => (
                  <option key={m} value={m}>
                    {m === "YAPE" ? "Yape" : m === "PLIN" ? "Plin" : m === "CASH" ? "Efectivo" : "Otro"}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Canal de venta</label>
              <select
                value={salesChannel}
                onChange={(e) => setSalesChannel(e.target.value)}
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
              >
                {salesChannelOptions.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="opNumber" className="text-xs text-muted-foreground">Número de operación</label>
              <Input
                id="opNumber"
                value={operationNumber}
                onChange={(e) => setOperationNumber(e.target.value)}
                placeholder="opcional"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Capturas (opcional, varias)</label>
              <input type="file" name="receipts" multiple accept="image/png,image/jpeg,image/webp" className="text-xs" />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="notes" className="text-xs text-muted-foreground">Notas</label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                maxLength={1000}
                className="min-h-12 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>

            {state.message && !state.ok ? (
              <p className="rounded-md bg-destructive/10 px-3 py-1.5 text-xs text-destructive">{state.message}</p>
            ) : null}

            <SubmitButton disabled={!canSubmit} />
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
