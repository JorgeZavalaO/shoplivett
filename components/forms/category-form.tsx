"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Save, Tag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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
            {state.fieldErrors?.name ? (
              <p className="text-xs text-destructive">{state.fieldErrors.name}</p>
            ) : null}
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
          <SubmitButton label={mode === "create" ? "Crear categoría" : "Guardar cambios"} />
        </div>
      </div>
    </form>
  );
}
