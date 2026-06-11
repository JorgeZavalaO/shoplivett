"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Save, Tag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  VARIANT_STATUSES,
  VARIANT_STATUS_LABELS,
} from "@/components/dashboard/variant-status-badge";
import type { VariantActionResult } from "@/actions/products";

type VariantFormProps = {
  mode: "create" | "edit";
  action: (
    prev: VariantActionResult | undefined,
    formData: FormData,
  ) => Promise<VariantActionResult>;
  initial?: {
    color: string | null;
    material: string | null;
    size: string | null;
    price: string;
    cost: string | null;
    barcode: string | null;
    status: "ACTIVE" | "HIDDEN" | "ARCHIVED";
    stock?: number;
  };
  cancelHref: string;
  codeHint?: string;
};

const initialState: VariantActionResult = { ok: false };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="min-w-40">
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Guardando…
        </>
      ) : (
        <>
          <Save className="size-4" /> {label}
        </>
      )}
    </Button>
  );
}

function CancelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button variant="ghost" render={<a href={href}>{children}</a>} />
  );
}

export function VariantForm({
  mode,
  action,
  initial,
  cancelHref,
  codeHint,
}: VariantFormProps) {
  const [state, formAction] = useActionState<VariantActionResult, FormData>(
    action,
    initialState,
  );
  const [color, setColor] = useState(initial?.color ?? "");
  const preview = color ? `Se generará un código al guardar (ej. CART-…-${color.toUpperCase().slice(0, 3)}-0001).` : "";

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {mode === "create" ? "Nueva variante" : "Editar variante"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="color" className="text-sm font-medium">
              Color
            </label>
            <Input
              id="color"
              name="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              maxLength={60}
              placeholder="Negro"
            />
            {preview ? (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Tag className="size-3" /> {preview}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="material" className="text-sm font-medium">
              Material
            </label>
            <Input
              id="material"
              name="material"
              defaultValue={initial?.material ?? ""}
              maxLength={60}
              placeholder="Cuero"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="size" className="text-sm font-medium">
              Tamaño
            </label>
            <Input
              id="size"
              name="size"
              defaultValue={initial?.size ?? ""}
              maxLength={60}
              placeholder="Mediano"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="barcode" className="text-sm font-medium">
              Código de barras
            </label>
            <Input
              id="barcode"
              name="barcode"
              defaultValue={initial?.barcode ?? ""}
              maxLength={40}
              placeholder="opcional"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="price" className="text-sm font-medium">
              Precio de venta *
            </label>
            <Input
              id="price"
              name="price"
              type="text"
              inputMode="decimal"
              defaultValue={initial?.price ?? ""}
              required
              placeholder="0.00"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="cost" className="text-sm font-medium">
              Costo
            </label>
            <Input
              id="cost"
              name="cost"
              type="text"
              inputMode="decimal"
              defaultValue={initial?.cost ?? ""}
              placeholder="opcional"
            />
          </div>

          {mode === "create" ? (
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label htmlFor="stock" className="text-sm font-medium">
                Stock inicial *
              </label>
              <Input
                id="stock"
                name="stock"
                type="number"
                min={0}
                max={100000}
                defaultValue={initial?.stock ?? 0}
                required
              />
              <p className="text-xs text-muted-foreground">
                Se registrará un movimiento de inventario IN con la cantidad indicada.
              </p>
            </div>
          ) : null}

          {mode === "edit" ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="status" className="text-sm font-medium">
                Estado
              </label>
              <select
                id="status"
                name="status"
                defaultValue={initial?.status ?? "ACTIVE"}
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {VARIANT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {VARIANT_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {codeHint ? (
            <div className="md:col-span-2 rounded-md border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
              Código actual: <code className="font-mono">{codeHint}</code>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <p
          className={cn(
            "text-sm",
            state.ok ? "text-emerald-600" : "text-destructive",
            !state.message && "text-transparent",
          )}
        >
          {state.message ?? "·"}
        </p>
        <div className="flex items-center gap-2">
          <CancelLink href={cancelHref}>Cancelar</CancelLink>
          <SubmitButton label={mode === "create" ? "Crear variante" : "Guardar cambios"} />
        </div>
      </div>
    </form>
  );
}
