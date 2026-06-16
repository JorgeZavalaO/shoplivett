"use client";

import { useActionState } from "react";

import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { FieldError } from "@/components/ui/field-error";
import { FormMessage } from "@/components/ui/form-message";
import { CancelLink } from "@/components/ui/cancel-link";
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
            <FieldError message={state.fieldErrors?.name} />
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
            <FieldError message={state.fieldErrors?.categoryId} />
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
        <FormMessage ok={state.ok} message={state.message} />
        <div className="flex items-center gap-2">
          <CancelLink href={cancelHref} />
          <SubmitButton label={mode === "create" ? "Crear producto" : "Guardar cambios"} />
        </div>
      </div>
    </form>
  );
}
