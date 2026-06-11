"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  adjustStockAction,
  type InventoryAdjustActionResult,
} from "@/actions/inventory";

type Props = {
  variantId: string;
  defaultType?: "IN" | "ADJUSTMENT";
};

const initialState: InventoryAdjustActionResult = { ok: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Aplicando…
        </>
      ) : (
        <>
          <Save className="size-4" /> Aplicar ajuste
        </>
      )}
    </Button>
  );
}

export function InventoryAdjustForm({ variantId, defaultType = "IN" }: Props) {
  const [state, formAction] = useActionState<
    InventoryAdjustActionResult,
    FormData
  >(
    adjustStockAction.bind(null, variantId) as (
      prev: InventoryAdjustActionResult | undefined,
      formData: FormData,
    ) => Promise<InventoryAdjustActionResult>,
    initialState,
  );

  const [type, setType] = useState<"IN" | "ADJUSTMENT">(defaultType);
  const [quantity, setQuantity] = useState<string>("");

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Tipo de movimiento</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setType("IN")}
            className={cn(
              "rounded-md border px-3 py-2 text-sm",
              type === "IN"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-muted",
            )}
          >
            Ingreso (+ stock)
          </button>
          <button
            type="button"
            onClick={() => setType("ADJUSTMENT")}
            className={cn(
              "rounded-md border px-3 py-2 text-sm",
              type === "ADJUSTMENT"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-muted",
            )}
          >
            Ajuste (+ o −)
          </button>
        </div>
        <input type="hidden" name="type" value={type} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="quantity" className="text-sm font-medium">
          Cantidad {type === "IN" ? "(positiva)" : "(positiva o negativa)"}
        </label>
        <Input
          id="quantity"
          name="quantity"
          type="number"
          step="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
          placeholder={type === "IN" ? "5" : "5 o -3"}
          aria-invalid={Boolean(state.fieldErrors?.quantity)}
        />
        {state.fieldErrors?.quantity ? (
          <p className="text-xs text-destructive">{state.fieldErrors.quantity}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="reason" className="text-sm font-medium">
          Motivo (obligatorio)
        </label>
        <textarea
          id="reason"
          name="reason"
          required
          minLength={5}
          maxLength={200}
          rows={3}
          placeholder="Ej: Ingreso de mercadería del proveedor, merma, corrección de inventario…"
          aria-invalid={Boolean(state.fieldErrors?.reason)}
          className="min-h-20 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        {state.fieldErrors?.reason ? (
          <p className="text-xs text-destructive">{state.fieldErrors.reason}</p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p
          className={cn(
            "text-sm",
            state.ok ? "text-emerald-600" : "text-destructive",
            !state.message && "text-transparent",
          )}
        >
          {state.message ?? "·"}
        </p>
        <SubmitButton />
      </div>
    </form>
  );
}
