"use client";

import { useActionState, useState } from "react";
import { Tag } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { FieldError } from "@/components/ui/field-error";
import { FormMessage } from "@/components/ui/form-message";
import { CancelLink } from "@/components/ui/cancel-link";
import { slugify } from "@/lib/category-helpers";
import type { CategoryActionResult } from "@/actions/categories";

type CategoryFormProps = {
  mode: "create" | "edit";
  action: (
    prev: CategoryActionResult | undefined,
    formData: FormData,
  ) => Promise<CategoryActionResult>;
  initial?: { name: string; isActive?: boolean };
  cancelHref: string;
};

const initialState: CategoryActionResult = { ok: false };

export function CategoryForm({
  mode,
  action,
  initial,
  cancelHref,
}: CategoryFormProps) {
  const [state, formAction] = useActionState<CategoryActionResult, FormData>(
    action,
    initialState,
  );
  const [name, setName] = useState(initial?.name ?? "");
  const slugPreview = slugify(name);

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {mode === "create" ? "Nueva categoría" : "Editar categoría"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-sm font-medium">
              Nombre *
            </label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={60}
              placeholder="Carteras de mano"
              aria-invalid={Boolean(state.fieldErrors?.name)}
            />
            {slugPreview ? (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Tag className="size-3" /> Slug: <code>{slugPreview}</code>
              </p>
            ) : null}
            <FieldError message={state.fieldErrors?.name} />
          </div>

          {mode === "edit" ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={initial?.isActive ?? true}
                className="size-4 accent-primary"
              />
              Activa
            </label>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <FormMessage ok={state.ok} message={state.message} />
        <div className="flex items-center gap-2">
          <CancelLink href={cancelHref} />
          <SubmitButton label={mode === "create" ? "Crear categoría" : "Guardar cambios"} />
        </div>
      </div>
    </form>
  );
}
