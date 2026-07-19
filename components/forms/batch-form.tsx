"use client";

import { useActionState, useState, useCallback, useRef } from "react";
import { Search, X } from "lucide-react";

import type { BatchActionResult } from "@/actions/import-batches";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { FieldError } from "@/components/ui/field-error";
import { FormMessage } from "@/components/ui/form-message";
import { CancelLink } from "@/components/ui/cancel-link";
import { searchVariantsForBatchAction } from "@/actions/import-batches";

type VariantOption = {
  id: string;
  code: string;
  color: string | null;
  price: string;
  stock: number;
  product: { id: string; name: string };
};

const initialState: BatchActionResult = { ok: false };

export function BatchForm({
  action,
  cancelHref,
}: {
  action: (
    prev: BatchActionResult | undefined,
    formData: FormData,
  ) => Promise<BatchActionResult>;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState<BatchActionResult, FormData>(
    action,
    initialState,
  );

  const [items, setItems] = useState<
    Array<{
      variantId: string;
      code: string;
      productName: string;
      color: string | null;
      quantityPurchased: number;
      quantityReceived: number;
      unitCostUsd: string;
      weight: string;
    }>
  >([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<VariantOption[]>([]);
  const [searching, setSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await searchVariantsForBatchAction(q);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  function addItem(variant: VariantOption) {
    if (items.some((i) => i.variantId === variant.id)) return;
    setItems((prev) => [
      ...prev,
      {
        variantId: variant.id,
        code: variant.code,
        productName: variant.product.name,
        color: variant.color,
        quantityPurchased: 1,
        quantityReceived: 1,
        unitCostUsd: "",
        weight: "0",
      },
    ]);
    setSearchQuery("");
    setSearchResults([]);
  }

  function removeItem(variantId: string) {
    setItems((prev) => prev.filter((i) => i.variantId !== variantId));
  }

  function updateItem(
    variantId: string,
    field: string,
    value: string | number,
  ) {
    setItems((prev) =>
      prev.map((i) => (i.variantId === variantId ? { ...i, [field]: value } : i)),
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Información del lote</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="purchaseDate" className="text-sm font-medium">
              Fecha de compra *
            </label>
            <Input
              id="purchaseDate"
              name="purchaseDate"
              type="date"
              required
              defaultValue={new Date().toISOString().split("T")[0]}
              aria-invalid={Boolean(state.fieldErrors?.purchaseDate)}
            />
            <FieldError message={state.fieldErrors?.purchaseDate} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="exchangeRate" className="text-sm font-medium">
              Tipo de cambio (USD → PEN) *
            </label>
            <Input
              id="exchangeRate"
              name="exchangeRate"
              type="number"
              step="0.0001"
              min="0.0001"
              required
              placeholder="3.75"
              aria-invalid={Boolean(state.fieldErrors?.exchangeRate)}
            />
            <FieldError message={state.fieldErrors?.exchangeRate} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="shopper" className="text-sm font-medium">
              Shopper *
            </label>
            <Input
              id="shopper"
              name="shopper"
              required
              maxLength={100}
              placeholder="Nombre del shopper"
              aria-invalid={Boolean(state.fieldErrors?.shopper)}
            />
            <FieldError message={state.fieldErrors?.shopper} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="agency" className="text-sm font-medium">
              Agencia *
            </label>
            <Input
              id="agency"
              name="agency"
              required
              maxLength={100}
              placeholder="Nombre de la agencia"
              aria-invalid={Boolean(state.fieldErrors?.agency)}
            />
            <FieldError message={state.fieldErrors?.agency} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="totalCostUsd" className="text-sm font-medium">
              Costo total USD *
            </label>
            <Input
              id="totalCostUsd"
              name="totalCostUsd"
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="1500.00"
              aria-invalid={Boolean(state.fieldErrors?.totalCostUsd)}
            />
            <FieldError message={state.fieldErrors?.totalCostUsd} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="totalAdditionalCostsUsd" className="text-sm font-medium">
              Costos adicionales USD
            </label>
            <Input
              id="totalAdditionalCostsUsd"
              name="totalAdditionalCostsUsd"
              type="number"
              step="0.01"
              min="0"
              defaultValue="0"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="totalAdditionalCostsPen" className="text-sm font-medium">
              Costos adicionales PEN
            </label>
            <Input
              id="totalAdditionalCostsPen"
              name="totalAdditionalCostsPen"
              type="number"
              step="0.01"
              min="0"
              defaultValue="0"
            />
          </div>

          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label htmlFor="notes" className="text-sm font-medium">
              Notas
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              maxLength={1000}
              className="min-h-20 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              placeholder="Notas del lote..."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Productos del lote</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="relative">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                  searchDebounceRef.current = setTimeout(() => {
                    doSearch(e.target.value);
                  }, 300);
                }}
                placeholder="Buscar producto por código o nombre…"
                className="pl-9"
              />
            </div>
            {searchResults.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-card shadow-lg">
                {searchResults.map((variant) => (
                  <li
                    key={variant.id}
                    className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm hover:bg-accent"
                    onClick={() => addItem(variant)}
                  >
                    <div>
                      <span className="font-mono text-xs text-muted-foreground">
                        {variant.code}
                      </span>
                      <span className="ml-2">{variant.product.name}</span>
                      {variant.color && (
                        <span className="ml-1 text-muted-foreground">
                          ({variant.color})
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Stock: {variant.stock} · S/ {Number(variant.price).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {searching && (
              <p className="mt-1 text-xs text-muted-foreground">Buscando…</p>
            )}
          </div>

          {items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-2 font-medium">Producto</th>
                    <th className="p-2 font-medium">Cant. comprada</th>
                    <th className="p-2 font-medium">Cant. recibida</th>
                    <th className="p-2 font-medium">Costo unit. USD</th>
                    <th className="p-2 font-medium">Peso</th>
                    <th className="w-8 p-2" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.variantId} className="border-b border-border/50">
                      <td className="py-2 pr-2">
                        <input type="hidden" name="variantId" value={item.variantId} />
                        <span className="font-mono text-xs text-muted-foreground">
                          {item.code}
                        </span>
                        <span className="ml-1">{item.productName}</span>
                        {item.color && (
                          <span className="ml-1 text-muted-foreground">({item.color})</span>
                        )}
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          min={0}
                          value={item.quantityPurchased}
                          onChange={(e) =>
                            updateItem(item.variantId, "quantityPurchased", Number(e.target.value))
                          }
                          name="quantityPurchased"
                          className="h-8 w-24 text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          min={0}
                          value={item.quantityReceived}
                          onChange={(e) =>
                            updateItem(item.variantId, "quantityReceived", Number(e.target.value))
                          }
                          name="quantityReceived"
                          className="h-8 w-24 text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          step="0.0001"
                          min="0"
                          value={item.unitCostUsd}
                          onChange={(e) =>
                            updateItem(item.variantId, "unitCostUsd", e.target.value)
                          }
                          name="unitCostUsd"
                          placeholder="0.0000"
                          className="h-8 w-28 text-xs font-mono"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          step="0.0001"
                          min="0"
                          value={item.weight}
                          onChange={(e) =>
                            updateItem(item.variantId, "weight", e.target.value)
                          }
                          name="weight"
                          placeholder="0"
                          className="h-8 w-20 text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <button
                          type="button"
                          onClick={() => removeItem(item.variantId)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Eliminar item"
                        >
                          <X className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Busca y agrega productos al lote.
            </p>
          )}
          <FieldError message={state.fieldErrors?.items} />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <FormMessage ok={state.ok} message={state.message} />
        <div className="flex items-center gap-2">
          <CancelLink href={cancelHref} />
          <SubmitButton label="Crear lote" />
        </div>
      </div>
    </form>
  );
}
