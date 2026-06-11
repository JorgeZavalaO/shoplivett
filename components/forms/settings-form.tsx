"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  initialSettingsState,
  updateSettingsAction,
  type SettingsActionState,
} from "@/actions/settings";
import {
  PAYMENT_METHOD_LABELS,
  SHIPPING_METHOD_LABELS,
} from "@/lib/settings-defaults";
import { cn } from "@/lib/utils";

type SettingsFormProps = {
  initial: {
    reservationDays: number;
    minimumAdvance: string;
    currency: string;
    freeShippingEnabled: boolean;
    freeShippingThreshold: string;
    productCodePrefix: string;
    allowOverpaymentCredit: boolean;
    allowRefund: boolean;
    enabledPaymentMethods: string[];
    enabledShippingMethods: string[];
    paymentValidatorRoles: string[];
  };
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  SELLER: "Vendedora",
  DISPATCH: "Despacho",
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="min-w-40">
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Guardando…
        </>
      ) : (
        <>
          <Save className="size-4" /> Guardar cambios
        </>
      )}
    </Button>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

function CheckboxRow({
  name,
  value,
  label,
  defaultChecked,
}: {
  name: string;
  value: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="size-4 accent-primary"
      />
      <span>{label}</span>
    </label>
  );
}

export function SettingsForm({ initial }: SettingsFormProps) {
  const [state, formAction] = useActionState<SettingsActionState, FormData>(
    updateSettingsAction,
    initialSettingsState,
  );

  useEffect(() => {
    if (state.ok) toast.success(state.message ?? "Configuración guardada.");
    if (!state.ok && state.message && !state.fieldErrors) {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Reservas"
          description="Plazo y condiciones para separar productos durante un live."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reservationDays" className="text-sm font-medium">
                Días de reserva
              </label>
              <Input
                id="reservationDays"
                name="reservationDays"
                type="number"
                min={1}
                max={60}
                defaultValue={initial.reservationDays}
                required
                aria-invalid={Boolean(state.fieldErrors?.reservationDays)}
              />
              <p className="text-xs text-muted-foreground">
                Días que dura la separación antes de vencer.
              </p>
              <FieldError message={state.fieldErrors?.reservationDays} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="minimumAdvance" className="text-sm font-medium">
                Adelanto mínimo (S/)
              </label>
              <Input
                id="minimumAdvance"
                name="minimumAdvance"
                type="text"
                inputMode="decimal"
                defaultValue={initial.minimumAdvance}
                required
                aria-invalid={Boolean(state.fieldErrors?.minimumAdvance)}
              />
              <FieldError message={state.fieldErrors?.minimumAdvance} />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Moneda y catálogo"
          description="Parámetros generales del negocio."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="currency" className="text-sm font-medium">
                Moneda
              </label>
              <Input
                id="currency"
                name="currency"
                type="text"
                maxLength={3}
                defaultValue={initial.currency}
                className="uppercase"
                required
                aria-invalid={Boolean(state.fieldErrors?.currency)}
              />
              <FieldError message={state.fieldErrors?.currency} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="productCodePrefix" className="text-sm font-medium">
                Prefijo de código
              </label>
              <Input
                id="productCodePrefix"
                name="productCodePrefix"
                type="text"
                maxLength={6}
                defaultValue={initial.productCodePrefix}
                className="uppercase"
                required
                aria-invalid={Boolean(state.fieldErrors?.productCodePrefix)}
              />
              <p className="text-xs text-muted-foreground">
                Ej. CART, BAG, MOCHILA.
              </p>
              <FieldError message={state.fieldErrors?.productCodePrefix} />
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Envíos"
        description="Reglas y medios disponibles para despachar pedidos."
      >
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="freeShippingEnabled"
            defaultChecked={initial.freeShippingEnabled}
            className="size-4 accent-primary"
          />
          Permitir envío gratis a partir de un monto mínimo
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="freeShippingThreshold" className="text-sm font-medium">
              Monto mínimo para envío gratis (S/)
            </label>
            <Input
              id="freeShippingThreshold"
              name="freeShippingThreshold"
              type="text"
              inputMode="decimal"
              defaultValue={initial.freeShippingThreshold}
              aria-invalid={Boolean(state.fieldErrors?.freeShippingThreshold)}
            />
            <p className="text-xs text-muted-foreground">
              Usa 0 para deshabilitar el monto (mantiene la casilla).
            </p>
            <FieldError message={state.fieldErrors?.freeShippingThreshold} />
          </div>
        </div>
        <Separator />
        <div>
          <p className="mb-2 text-sm font-medium">Medios de envío habilitados</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(SHIPPING_METHOD_LABELS).map(([value, label]) => (
              <CheckboxRow
                key={value}
                name="enabledShippingMethods"
                value={value}
                label={label}
                defaultChecked={initial.enabledShippingMethods.includes(value)}
              />
            ))}
          </div>
          <FieldError message={state.fieldErrors?.enabledShippingMethods} />
        </div>
      </SectionCard>

      <SectionCard
        title="Pagos"
        description="Medios aceptados, reglas de sobrepago y roles validadores."
      >
        <div>
          <p className="mb-2 text-sm font-medium">Medios de pago habilitados</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
              <CheckboxRow
                key={value}
                name="enabledPaymentMethods"
                value={value}
                label={label}
                defaultChecked={initial.enabledPaymentMethods.includes(value)}
              />
            ))}
          </div>
          <FieldError message={state.fieldErrors?.enabledPaymentMethods} />
        </div>
        <Separator />
        <div>
          <p className="mb-2 text-sm font-medium">Roles que pueden validar pagos</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <CheckboxRow
                key={value}
                name="paymentValidatorRoles"
                value={value}
                label={label}
                defaultChecked={initial.paymentValidatorRoles.includes(value)}
              />
            ))}
          </div>
          <FieldError message={state.fieldErrors?.paymentValidatorRoles} />
        </div>
        <Separator />
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="allowOverpaymentCredit"
              defaultChecked={initial.allowOverpaymentCredit}
              className="size-4 accent-primary"
            />
            Permitir crédito por sobrepago
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="allowRefund"
              defaultChecked={initial.allowRefund}
              className="size-4 accent-primary"
            />
            Permitir devolución
          </label>
        </div>
      </SectionCard>

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
        <SubmitButton />
      </div>
    </form>
  );
}
