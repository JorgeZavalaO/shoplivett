"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Loader2, Save } from "lucide-react";

import type { LiveActionResult } from "@/actions/lives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const LIVE_CHANNEL_OPTIONS = [
  { value: "TIKTOK", label: "TikTok" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "OTHER", label: "Otro" },
] as const;

type Props = {
  mode: "create" | "edit";
  action: (
    prev: LiveActionResult | undefined,
    formData: FormData,
  ) => Promise<LiveActionResult>;
  cancelHref: string;
  initial?: {
    name: string;
    channel: "TIKTOK" | "INSTAGRAM" | "FACEBOOK" | "WHATSAPP" | "OTHER";
    responsibleId: string | null;
    notes: string | null;
  };
  responsibles: { id: string; name: string; email: string }[];
};

const initialState: LiveActionResult = { ok: false };

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

function CancelLink({ href }: { href: string }) {
  return <Button variant="ghost" render={<Link href={href}>Cancelar</Link>} />;
}

export function LiveForm({
  mode,
  action,
  cancelHref,
  initial,
  responsibles,
}: Props) {
  const [state, formAction] = useActionState<LiveActionResult, FormData>(
    action,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {mode === "create" ? "Nuevo live" : "Editar live"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label htmlFor="name" className="text-sm font-medium">
              Nombre *
            </label>
            <Input
              id="name"
              name="name"
              defaultValue={initial?.name}
              required
              maxLength={120}
              placeholder="Live de carteras noche"
              aria-invalid={Boolean(state.fieldErrors?.name)}
            />
            {state.fieldErrors?.name ? (
              <p className="text-xs text-destructive">{state.fieldErrors.name}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="channel" className="text-sm font-medium">
              Canal *
            </label>
            <select
              id="channel"
              name="channel"
              defaultValue={initial?.channel ?? "TIKTOK"}
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {LIVE_CHANNEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="responsibleId" className="text-sm font-medium">
              Responsable
            </label>
            <select
              id="responsibleId"
              name="responsibleId"
              defaultValue={initial?.responsibleId ?? ""}
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Sin asignar</option>
              {responsibles.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label htmlFor="notes" className="text-sm font-medium">
              Observaciones
            </label>
            <textarea
              id="notes"
              name="notes"
              defaultValue={initial?.notes ?? ""}
              rows={4}
              maxLength={1000}
              className="min-h-24 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              placeholder="Notas del live, promos, objetivos, etc."
            />
          </div>
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
          <CancelLink href={cancelHref} />
          <SubmitButton label={mode === "create" ? "Crear live" : "Guardar cambios"} />
        </div>
      </div>
    </form>
  );
}
