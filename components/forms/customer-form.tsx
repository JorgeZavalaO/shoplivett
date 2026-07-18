"use client";

import { useActionState, useState } from "react";

import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { FieldError } from "@/components/ui/field-error";
import { FormMessage } from "@/components/ui/form-message";
import { CancelLink } from "@/components/ui/cancel-link";
import { cn } from "@/lib/utils";
import { formatWhatsAppDisplay, normalizeWhatsApp } from "@/lib/phone";
import {
  CUSTOMER_STATUSES,
  CUSTOMER_STATUS_LABELS,
} from "@/components/dashboard/customer-status-badge";
import type { CustomerActionResult } from "@/lib/customers-types";

export type { CustomerActionResult };

type CustomerFormProps = {
  mode: "create" | "edit";
  action: (
    prev: CustomerActionResult | undefined,
    formData: FormData,
  ) => Promise<CustomerActionResult>;
  initial?: {
    name: string;
    whatsapp: string;
    document: string | null;
    address: string | null;
    district: string | null;
    reference: string | null;
    channel: string | null;
    notes: string | null;
    status: "ACTIVE" | "FREQUENT" | "RISKY" | "BLOCKED";
  };
  cancelHref: string;
};

const initialState: CustomerActionResult = { ok: false };

export function CustomerForm({
  mode,
  action,
  initial,
  cancelHref,
}: CustomerFormProps) {
  const [state, formAction] = useActionState<CustomerActionResult, FormData>(
    action,
    initialState,
  );

  const initialWhatsapp = initial?.whatsapp ?? "";
  const [whatsappInput, setWhatsappInput] = useState(initialWhatsapp);
  const normalizedPreview = normalizeWhatsApp(whatsappInput);
  const [status, setStatus] = useState<string>(
    initial?.status ?? "ACTIVE",
  );

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {mode === "create" ? "Nueva clienta" : "Editar clienta"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label htmlFor="name" className="text-sm font-medium">
              Nombre completo *
            </label>
            <Input
              id="name"
              name="name"
              defaultValue={initial?.name}
              required
              maxLength={100}
              aria-invalid={Boolean(state.fieldErrors?.name)}
            />
            <FieldError message={state.fieldErrors?.name} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="whatsapp" className="text-sm font-medium">
              WhatsApp *
            </label>
            <Input
              id="whatsapp"
              name="whatsapp"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+51 999 999 999"
              value={whatsappInput}
              onChange={(e) => setWhatsappInput(e.target.value)}
              required
              aria-invalid={Boolean(state.fieldErrors?.whatsapp)}
            />
            {normalizedPreview ? (
              <p className="text-xs text-muted-foreground">
                Se guardará como <code>{normalizedPreview}</code>
                {normalizedPreview !== whatsappInput ? (
                  <>
                    {" "}
                    (<span>{formatWhatsAppDisplay(normalizedPreview)}</span>)
                  </>
                ) : null}
              </p>
            ) : whatsappInput ? (
              <p className="text-xs text-amber-600">
                Ingresa 9 dígitos comenzando con 9.
              </p>
            ) : null}
            <FieldError message={state.fieldErrors?.whatsapp} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="document" className="text-sm font-medium">
              Documento
            </label>
            <Input
              id="document"
              name="document"
              defaultValue={initial?.document ?? ""}
              maxLength={120}
              placeholder="DNI o CE"
            />
          </div>

          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label htmlFor="address" className="text-sm font-medium">
              Dirección
            </label>
            <Input
              id="address"
              name="address"
              defaultValue={initial?.address ?? ""}
              maxLength={500}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="district" className="text-sm font-medium">
              Distrito
            </label>
            <Input
              id="district"
              name="district"
              defaultValue={initial?.district ?? ""}
              maxLength={120}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="reference" className="text-sm font-medium">
              Referencia
            </label>
            <Input
              id="reference"
              name="reference"
              defaultValue={initial?.reference ?? ""}
              maxLength={500}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="channel" className="text-sm font-medium">
              Canal
            </label>
            <Input
              id="channel"
              name="channel"
              defaultValue={initial?.channel ?? ""}
              maxLength={120}
              placeholder="ej. TikTok @shoplivett"
            />
          </div>

          {mode === "edit" ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="status" className="text-sm font-medium">
                Estado
              </label>
              <select
                id="status"
                name="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                aria-invalid={Boolean(state.fieldErrors?.status)}
              >
                {CUSTOMER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {CUSTOMER_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              <FieldError message={state.fieldErrors?.status} />
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label htmlFor="notes" className="text-sm font-medium">
              Notas
            </label>
            <textarea
              id="notes"
              name="notes"
              defaultValue={initial?.notes ?? ""}
              maxLength={500}
              className={cn(
                "min-h-24 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              )}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <FormMessage ok={state.ok} message={state.message} />
        <div className="flex items-center gap-2">
          <CancelLink href={cancelHref} />
          <SubmitButton label={mode === "create" ? "Crear clienta" : "Guardar cambios"} />
        </div>
      </div>
    </form>
  );
}
