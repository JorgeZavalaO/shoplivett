"use client";

import { useState, useActionState } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { addBatchItemAction, searchVariantsForBatchAction, type BatchActionResult } from "@/actions/import-batches";

type Props = {
  batchId: string;
  onSuccess?: () => void;
};

export function AddBatchItemForm({ batchId, onSuccess }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchVariantsForBatchAction>>>([]);
  const [selectedVariant, setSelectedVariant] = useState<string>("");
  const [searching, setSearching] = useState(false);

  const [fields, setFields] = useState({
    quantityPurchased: "1",
    quantityReceived: "0",
    unitCostUsd: "",
    weight: "0",
  });

  const [state, formAction] = useActionState<BatchActionResult | undefined, FormData>(
    async (_prev, formData) => {
      const result = await addBatchItemAction(batchId, _prev, formData);
      if (result.ok) {
        setQuery("");
        setResults([]);
        setSelectedVariant("");
        setFields({ quantityPurchased: "1", quantityReceived: "0", unitCostUsd: "", weight: "0" });
        onSuccess?.();
      }
      return result;
    },
    undefined,
  );

  async function handleSearch() {
    if (query.trim().length < 2) return;
    setSearching(true);
    const r = await searchVariantsForBatchAction(query);
    setResults(r);
    setSearching(false);
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="variantId" value={selectedVariant} />
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Buscar producto</label>
        <div className="flex gap-2">
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Código o nombre del producto"
            className="flex-1"
          />
          <Button type="button" size="sm" variant="outline" onClick={handleSearch} disabled={searching}>
            <Search className="size-4" />
          </Button>
        </div>
      </div>
      {searching && (
        <p className="text-xs text-muted-foreground">Buscando…</p>
      )}
      {results.length > 0 && (
        <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
          {results.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setSelectedVariant(v.id)}
              className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm text-left transition-colors hover:bg-muted ${
                selectedVariant === v.id ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20" : "border-border"
              }`}
            >
              <div>
                <p className="text-xs font-medium">{v.product.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{v.code}</p>
              </div>
              <p className="text-xs text-muted-foreground">S/ {v.price} · stock {v.stock}</p>
            </button>
          ))}
        </div>
      )}
      {selectedVariant && (
        <>
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
            Producto seleccionado
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="qtyPurchased" className="text-sm font-medium">Cant. comprada *</label>
              <Input
                id="qtyPurchased"
                name="quantityPurchased"
                type="number"
                min={1}
                value={fields.quantityPurchased}
                onChange={(e) => setFields((prev) => ({ ...prev, quantityPurchased: e.target.value }))}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="qtyReceived" className="text-sm font-medium">Cant. recibida *</label>
              <Input
                id="qtyReceived"
                name="quantityReceived"
                type="number"
                min={0}
                value={fields.quantityReceived}
                onChange={(e) => setFields((prev) => ({ ...prev, quantityReceived: e.target.value }))}
                required
              />
              <p className="text-[11px] text-muted-foreground">Parte de la cantidad comprada que ya llegó.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="unitCostUsd" className="text-sm font-medium">Costo unit. USD *</label>
              <Input
                id="unitCostUsd"
                name="unitCostUsd"
                inputMode="decimal"
                placeholder="0.00"
                value={fields.unitCostUsd}
                onChange={(e) => setFields((prev) => ({ ...prev, unitCostUsd: e.target.value }))}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="weight" className="text-sm font-medium">Peso (kg)</label>
              <Input
                id="weight"
                name="weight"
                inputMode="decimal"
                placeholder="0"
                value={fields.weight}
                onChange={(e) => setFields((prev) => ({ ...prev, weight: e.target.value }))}
              />
              <p className="text-[11px] text-muted-foreground">Opcional, usado para distribución de costos.</p>
            </div>
          </div>
        </>
      )}
      <FormMessage ok={state?.ok} message={state?.message} />
      {selectedVariant && (
        <SubmitButton label="Agregar al lote" savingLabel="Agregando…" />
      )}
    </form>
  );
}
