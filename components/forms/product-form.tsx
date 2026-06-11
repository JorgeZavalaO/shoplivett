"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ProductActionResult } from "@/actions/products";

type CategoryOption = {
  id: string;
  name: string;
  isActive: boolean;
};

type ProductFormProps = {
  mode: "create" | "edit";
  action: (
    prev: ProductActionResult | undefined,
    formData: FormData,
  ) => Promise<ProductActionResult>;
  initial?: {
    name: string;
    description: string | null;
    categoryId: string;
    isActive: boolean;
  };
  categories: CategoryOption[];
  cancelHref: string;
};

const initialState: ProductActionResult = { ok: false };

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
    <Button variant="ghost" render={<Link href={href}>{children}</Link>} />
  );
}

export function ProductForm({
  mode,
  action,
  initial,
  categories,
  cancelHref,
}: ProductFormProps) {
  const [state, formAction] = useActionState<ProductActionResult, FormData>(
    action,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {mode === "create" ? "Nuevo producto" : "Editar producto"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-sm font-medium">
              Nombre del modelo *
            </label>
            <Input
              id="name"
              name="name"
              defaultValue={initial?.name}
              required
              maxLength={120}
              placeholder="Cartera Valentina"
              aria-invalid={Boolean(state.fieldErrors?.name)}
            />
            {state.fieldErrors?.name ? (
              <p className="text-xs text-destructive">{state.fieldErrors.name}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="categoryId" className="text-sm font-medium">
              Categoría *
            </label>
            <select
              id="categoryId"
              name="categoryId"
              defaultValue={initial?.categoryId}
              required
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Selecciona una categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.isActive ? "" : " (inactiva)"}
                </option>
              ))}
            </select>
            {state.fieldErrors?.categoryId ? (
              <p className="text-xs text-destructive">{state.fieldErrors.categoryId}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="description" className="text-sm font-medium">
              Descripción
            </label>
            <textarea
              id="description"
              name="description"
              defaultValue={initial?.description ?? ""}
              maxLength={2000}
              className="min-h-24 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          {mode === "edit" ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={initial?.isActive ?? true}
                className="size-4 accent-primary"
              />
              Activo (visible en el sistema)
            </label>
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
          <SubmitButton label={mode === "create" ? "Crear producto" : "Guardar cambios"} />
        </div>
      </div>
    </form>
  );
}
