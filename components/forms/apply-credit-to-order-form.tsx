"use client";

import { useState, useActionState } from "react";
import { Search, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { FieldError } from "@/components/ui/field-error";
import { applyCreditToOrderAction, searchOrdersForCreditAction, type CreditActionResult } from "@/actions/credits";

type Props = {
  creditId: string;
  customerId: string;
  onSuccess?: () => void;
};

export function ApplyCreditToOrderForm({ creditId, customerId, onSuccess }: Props) {
  const [query, setQuery] = useState("");
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof searchOrdersForCreditAction>>>([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [searching, setSearching] = useState(false);
  const [state, formAction] = useActionState<CreditActionResult | undefined, FormData>(
    async (_prev, formData) => {
      const result = await applyCreditToOrderAction(_prev, formData);
      if (result.ok) {
        onSuccess?.();
      }
      return result;
    },
    undefined,
  );

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    const results = await searchOrdersForCreditAction(query, customerId);
    setOrders(results);
    setSearching(false);
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="creditId" value={creditId} />
      <input type="hidden" name="orderId" value={selectedOrderId} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="searchOrder" className="text-sm font-medium">Buscar pedido</label>
        <div className="flex gap-2">
          <input
            id="searchOrder"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="N° de pedido"
            className="flex-1 h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
          />
          <Button type="button" size="sm" variant="outline" onClick={handleSearch} disabled={searching}>
            <Search className="size-4" />
          </Button>
        </div>
      </div>
      {orders.length > 0 && (
        <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
          {orders.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setSelectedOrderId(o.id)}
              className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm text-left transition-colors hover:bg-muted ${
                selectedOrderId === o.id ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20" : "border-border"
              }`}
            >
              <span className="font-mono text-xs">{o.orderNumber}</span>
              <span className="flex items-center gap-2">
                S/ {o.balance}
                {selectedOrderId === o.id && <Check className="size-4 text-emerald-600" />}
              </span>
            </button>
          ))}
        </div>
      )}
      {selectedOrderId && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="applyAmount" className="text-sm font-medium">Monto a aplicar S/</label>
          <input
            id="applyAmount"
            name="amount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
            required
          />
          <FieldError message={state?.fieldErrors?.amount} />
        </div>
      )}
      <FormMessage ok={state?.ok} message={state?.message} />
      {selectedOrderId && (
        <SubmitButton label="Aplicar crédito" savingLabel="Aplicando…" />
      )}
    </form>
  );
}
