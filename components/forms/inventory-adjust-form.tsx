"use client";

import { useRef, useState } from "react";
import { Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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

function SubmitButton({ disabled }: { disabled: boolean }) {
  return (
    <Button type="submit" disabled={disabled} className="w-full">
      <Save className="size-4" /> Aplicar ajuste
    </Button>
  );
}

export function InventoryAdjustForm({ variantId, defaultType = "IN" }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<InventoryAdjustActionResult>(initialState);

  const [type, setType] = useState<"IN" | "ADJUSTMENT">(defaultType);
  const [quantity, setQuantity] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setConfirmOpen(true);
  }

  async function handleConfirm() {
    if (!formRef.current) return;
    setPending(true);
    const fd = new FormData(formRef.current);
    // Delegate to the server action manually
    const result = await adjustStockAction(
      variantId,
      undefined,
      fd,
    );
    setPending(false);
    setConfirmOpen(false);
    setState(result);
    if (result.ok) {
      setQuantity("");
      setReason("");
    }
  }

  const quantityNum = Number(quantity);
  const isQuantityValid = Number.isFinite(quantityNum) && quantityNum !== 0;
  const canSubmit = isQuantityValid && reason.trim().length >= 5;

  return (
    <>
      <form ref={formRef} className="flex flex-col gap-4" noValidate onSubmit={handleSubmit}>
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
            value={reason}
            onChange={(e) => setReason(e.target.value)}
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
          <SubmitButton disabled={!canSubmit} />
        </div>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirmar ajuste de inventario"
        description={
          <div className="flex flex-col gap-1 text-sm">
            <p><strong>Tipo:</strong> {type === "IN" ? "Ingreso" : "Ajuste"}</p>
            <p><strong>Cantidad:</strong> {quantity}</p>
            <p><strong>Motivo:</strong> {reason}</p>
          </div>
        }
        confirmLabel="Confirmar ajuste"
        tone={type === "ADJUSTMENT" && quantityNum < 0 ? "destructive" : "default"}
        pending={pending}
        onConfirm={handleConfirm}
      />
    </>
  );
}
