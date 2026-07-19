"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2, Minus, Plus, Search, ShoppingCart, UserPlus, UserRound, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AsyncSearchList } from "@/components/ui/async-search-list";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { MarginBadge } from "@/components/financial/margin-badge";
import { StockHealthBadge } from "@/components/financial/stock-health-badge";
import { CustomerStatusBadge } from "@/components/dashboard/customer-status-badge";
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

function describeQuickSaleError(
  code: string | undefined,
  message: string,
): { title: string; description: string } {
  switch (code) {
    case "INSUFFICIENT_STOCK":
    case "INSUFFICIENT_BATCH_STOCK":
      return {
        title: "Stock insuficiente para registrar la venta",
        description:
          "El producto ya está reservado por otro pedido o se agotó mientras se procesaba la venta. Revisa el carrito, actualiza el stock y, si es necesario, libera o cancela las reservas previas desde el pedido correspondiente.",
      };
    case "VARIANT_NOT_FOUND":
      return {
        title: "Producto no disponible",
        description: `${message} Actualiza la lista y vuelve a seleccionar el producto.`,
      };
    case "CUSTOMER_NOT_FOUND":
    case "CUSTOMER_BLOCKED":
      return {
        title: "Clienta no disponible",
        description: `${message} Selecciona otra clienta para continuar.`,
      };
    case "INVALID_ADVANCE":
      return {
        title: "Adelanto inválido",
        description: message,
      };
    case "LIVE_CLOSED":
      return {
        title: "El live ya se cerró",
        description: `${message} El pedido se registrará sin live asociado.`,
      };
    case "BLOB_ERROR":
      return {
        title: "No pudimos subir las capturas",
        description: `${message} Vuelve a intentar adjuntando imágenes más ligeras.`,
      };
    case "PAYMENT_ERROR":
      return {
        title: "No pudimos registrar el pago",
        description: `${message} Verifica los datos del pago e inténtalo nuevamente.`,
      };
    case "CONFLICT":
      return {
        title: "Conflicto al registrar la venta",
        description: `${message} Vuelve a intentarlo en unos segundos.`,
      };
    default:
      return {
        title: "No pudimos registrar la venta",
        description: message,
      };
  }
}

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
    <Button type="submit" size="lg" disabled={pending || disabled} className="mt-1 h-11 w-full text-base shadow-sm">
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
  catalogVariants: VariantSearchResult[];
};

export function QuickSaleForm({
  openLive,
  enabledPaymentMethods,
  salesChannelOptions,
  catalogVariants,
}: Props) {
  const [state, formAction] = useActionState<OrderActionResult, FormData>(
    createQuickSaleAction,
    initialState,
  );

  const router = useRouter();

  // Surface server-side errors via Sonner so the seller notices the issue
  // immediately instead of missing an inline message buried under the form.
  const lastErrorKey = useRef<string | null>(null);
  useEffect(() => {
    if (state.ok || !state.message) return;
    const key = `${state.code ?? "UNKNOWN"}::${state.message}`;
    if (lastErrorKey.current === key) return;
    lastErrorKey.current = key;
    const friendly = describeQuickSaleError(state.code, state.message);
    toast.error(friendly.title, {
      description: friendly.description,
      duration: 6000,
    });
    // Re-fetch the server-rendered catalog so the stock badges reflect the
    // latest reservations (especialmente tras un INSUFFICIENT_STOCK).
    router.refresh();
  }, [state, router]);

  const handleFormSubmit = useCallback(() => {
    lastErrorKey.current = null;
  }, []);

  // --- Customer ---
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerWhatsapp, setCustomerWhatsapp] = useState("");
  const [customerStatus, setCustomerStatus] = useState<
    "ACTIVE" | "FREQUENT" | "RISKY" | "BLOCKED" | null
  >(null);
  const [customerResults, setCustomerResults] = useState<
    { id: string; name: string; whatsapp: string; status: "ACTIVE" | "FREQUENT" | "RISKY" | "BLOCKED" }[]
  >([]);
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
  const [activeCategory, setActiveCategory] = useState("Todas");
  const catalogCategories = useMemo(
    () => [
      { name: "Todas", count: catalogVariants.length },
      ...Array.from(
        catalogVariants.reduce((categories, variant) => {
          categories.set(variant.categoryName, (categories.get(variant.categoryName) ?? 0) + 1);
          return categories;
        }, new Map<string, number>()),
      ).map(([name, count]) => ({ name, count })),
    ],
    [catalogVariants],
  );
  const visibleCatalogVariants = useMemo(
    () => activeCategory === "Todas"
      ? catalogVariants
      : catalogVariants.filter((variant) => variant.categoryName === activeCategory),
    [activeCategory, catalogVariants],
  );
  const searchVar = useCallback((q: string) => {
    setVariantQuery(q);
  }, []);

  const debouncedVariantQuery = useDebouncedValue(variantQuery, 300);
  useEffect(() => {
    if (debouncedVariantQuery.length < 2) {
      setVariantResults([]);
      setVariantError(null);
      return;
    }
    setVariantLoading(true);
    setVariantError(null);
    searchVariant(async () => {
      try {
        const res = await searchVariantsForSaleAction(debouncedVariantQuery);
        setVariantResults(res);
      } catch (err) {
        console.error(err);
        setVariantError("No pudimos buscar productos. Intenta nuevamente.");
        setVariantResults([]);
      } finally {
        setVariantLoading(false);
      }
    });
  }, [debouncedVariantQuery]);

  const displayedVariants = variantQuery.trim().length >= 2
    ? variantResults
    : visibleCatalogVariants;

  // --- Cart ---
  const [cart, setCart] = useState<CartItem[]>([]);
  const addToCart = (v: VariantSearchResult) => {
    if (v.available < 1) return;
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

  const isCustomerBlocked = customerStatus === "BLOCKED";
  const canSubmit = Boolean(
    customerId && !isCustomerBlocked && cart.length > 0 && advanceAmount && Number(advanceAmount) > 0,
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
    <form action={formAction} onSubmit={handleFormSubmit} className="flex flex-col gap-5 lg:flex-row lg:items-start" noValidate>
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
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        {/* Live */}
        {openLive ? (
          <div className="flex items-center justify-between rounded-xl border border-emerald-200/80 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-sm dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200">
            <span><span className="mr-2 inline-block size-2 rounded-full bg-emerald-500 align-middle shadow-[0_0_0_3px_rgb(16_185_129_/_15%)]" />Live activo</span>
            <span className="font-semibold">{openLive.name}</span>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
            El pedido se registrará sin live asociado.
          </div>
        )}

        {/* Variant search */}
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="border-b border-border/70 py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
              <Search className="size-4 text-muted-foreground" /> 02 · Productos
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 py-4">
            <label className="text-xs font-medium text-muted-foreground">Busca o selecciona un producto</label>
            <AsyncSearchList
              value={variantQuery}
              onValueChange={setVariantQuery}
              onSearch={(q) => void searchVar(q)}
              isLoading={variantLoading}
              isQueryTooShort={variantQuery.length > 0 && variantQuery.length < 2}
              results={variantResults}
              errorMessage={variantError}
              placeholder="Buscar por código, nombre o color…"
              emptyMessage="Escribe al menos 2 caracteres para buscar."
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
                  </div>
                </div>
              )}
            />
            {variantQuery.trim().length < 2 ? (
              <>
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {catalogCategories.map((category) => (
                    <button
                      key={category.name}
                      type="button"
                      onClick={() => setActiveCategory(category.name)}
                      className={`shrink-0 rounded-lg border px-3 py-2 text-left transition-colors ${
                        activeCategory === category.name
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-border bg-card hover:bg-muted"
                      }`}
                    >
                      <span className="block text-xs font-semibold">{category.name}</span>
                      <span className={`block text-[10px] ${activeCategory === category.name ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
                        {category.count} disponibles
                      </span>
                    </button>
                  ))}
                </div>
                <div className="grid max-h-[37rem] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 xl:grid-cols-4">
                  {displayedVariants.map((variant) => (
                    <div key={variant.id} className="group flex flex-col overflow-hidden rounded-xl border border-border/80 bg-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                      <div className="relative aspect-square overflow-hidden bg-muted/40">
                        {variant.imageUrl ? (
                          <Image
                            src={variant.imageUrl}
                            alt={variant.productName}
                            fill
                            sizes="(min-width: 1280px) 14vw, (min-width: 640px) 25vw, 45vw"
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-muted-foreground">
                            <ShoppingCart className="size-8 opacity-30" />
                          </div>
                        )}
                        <span className="absolute left-2 top-2 rounded-md bg-background/90 px-1.5 py-0.5 text-[10px] font-medium shadow-sm">
                          {variant.available > 0 ? `${variant.available} en stock` : "Agotado"}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col gap-1.5 p-3">
                        <p className="line-clamp-2 min-h-8 text-xs font-semibold leading-4">{variant.productName}</p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {variant.code}{variant.color ? ` · ${variant.color}` : ""}
                        </p>
                        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                          <span className="text-sm font-bold">S/ {variant.price}</span>
                          <Button
                            type="button"
                            size="icon-sm"
                            aria-label={`Agregar ${variant.productName}`}
                            disabled={variant.available < 1}
                            onClick={() => addToCart(variant)}
                          >
                            <Plus className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {displayedVariants.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                    No hay productos en esta categoría.
                  </p>
                ) : null}
              </>
            ) : null}
          {state.fieldErrors?.items ? (
            <p className="text-xs text-destructive">{state.fieldErrors.items}</p>
          ) : null}
          </CardContent>
        </Card>

        {/* Cart */}
        {cart.length === 0 ? (
          <Card className="border-dashed border-border bg-card shadow-sm">
            <CardContent className="flex flex-col items-center gap-2 py-12">
              <div className="rounded-full bg-muted p-3"><ShoppingCart className="size-6 text-muted-foreground" /></div>
              <p className="text-sm font-medium">Tu carrito está vacío</p>
              <p className="text-xs text-muted-foreground">Busca un producto arriba para comenzar la venta.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border/70 bg-muted/30 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Carrito de venta</p>
                <p className="text-xs text-muted-foreground">{cart.length} producto{cart.length === 1 ? "" : "s"}</p>
              </div>
              <ShoppingCart className="size-4 text-muted-foreground" />
            </div>
            {cart.map((item) => (
              <div key={item.variantId} className="flex items-start gap-3 border-b border-border/70 px-4 py-3.5 last:border-b-0">
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
                  <button type="button" aria-label={`Reducir cantidad de ${item.name}`} onClick={() => updateQty(item.variantId, -1)} className="rounded-md border border-border p-1 hover:bg-muted">
                    <Minus className="size-3" />
                  </button>
                  <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                   <button type="button" aria-label={`Aumentar cantidad de ${item.name}`} onClick={() => updateQty(item.variantId, 1)} disabled={item.quantity >= item.max} className="rounded-md border border-border p-1 hover:bg-muted disabled:opacity-50">
                    <Plus className="size-3" />
                  </button>
                </div>
                <button type="button" aria-label={`Eliminar ${item.name}`} onClick={() => removeItem(item.variantId)} className="ml-1 rounded-md p-1 text-destructive hover:bg-destructive/10">
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: summary */}
      <div className="flex w-full shrink-0 flex-col gap-4 lg:sticky lg:top-4 lg:w-[22rem]">
        {/* Customer */}
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="border-b border-border/70 py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
              <UserRound className="size-4 text-muted-foreground" /> 01 · Clienta
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 py-4">
            <label className="text-xs font-medium text-muted-foreground">Asocia la venta a una clienta</label>
            {customerName ? (
              <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{customerName}</p>
                    <p className="text-xs text-muted-foreground">{formatWhatsAppDisplay(customerWhatsapp)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {customerStatus ? <CustomerStatusBadge status={customerStatus} /> : null}
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerId("");
                        setCustomerName("");
                        setCustomerWhatsapp("");
                        setCustomerStatus(null);
                        setCustomerQuery("");
                      }}
                      aria-label="Cambiar clienta"
                      className="rounded-md p-1 text-destructive hover:bg-destructive/10"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>
                {isCustomerBlocked ? (
                  <p className="rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                    Esta clienta está bloqueada y no puede registrar nuevas ventas.
                  </p>
                ) : null}
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
                    setCustomerWhatsapp(c.whatsapp);
                    setCustomerStatus(c.status);
                    setCustomerQuery("");
                    setCustomerResults([]);
                  }}
                  renderItem={(c) => (
                    <>
                      <span className="font-medium">{c.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {formatWhatsAppDisplay(c.whatsapp)}
                      </span>
                      {c.status === "BLOCKED" ? (
                        <span className="ml-2 text-xs font-medium text-destructive">Bloqueada</span>
                      ) : null}
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
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-md">
          <CardHeader className="border-b border-border/70 bg-muted/20 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="size-4 text-primary" /> 03 · Cobro
            </CardTitle>
            <p className="text-xs text-muted-foreground">Revisa el total y registra el adelanto.</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3.5 pt-4">
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
            <div className="flex items-end justify-between border-t border-border pt-3">
              <span>Total</span>
              <span className="text-2xl font-bold tracking-tight">S/ {totals.total}</span>
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
