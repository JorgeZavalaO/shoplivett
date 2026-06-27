"use client";

import { useActionState, useEffect, useMemo } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SubmitButton } from "@/components/ui/submit-button";
import { FieldError } from "@/components/ui/field-error";
import { FormMessage } from "@/components/ui/form-message";
import {
  initialSettingsState,
  updateSettingsAction,
  type SettingsActionState,
} from "@/actions/settings";
import {
  COST_ALLOCATION_METHOD_LABELS,
  PAYMENT_METHOD_LABELS,
  SALES_CHANNEL_LABELS,
  SHIPPING_METHOD_LABELS,
  type PaymentMethodFees,
} from "@/lib/settings-defaults";
import type {
  CostAllocationMethod,
  PaymentMethod,
  Role,
  SalesChannel,
  ShippingMethod,
} from "@prisma/client";

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
    enabledPaymentMethods: PaymentMethod[];
    enabledShippingMethods: ShippingMethod[];
    paymentValidatorRoles: Role[];
    defaultExchangeRate: string;
    minimumTargetMarginBps: number;
    objectiveTargetMarginBps: number;
    defaultCostAllocationMethod: CostAllocationMethod;
    mixedValueAllocationPercent: number;
    mixedWeightAllocationPercent: number;
    standardPackagingCostPen: string;
    paymentMethodFees: PaymentMethodFees;
    enabledSalesChannels: SalesChannel[];
  };
};

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  SELLER: "Vendedora",
  DISPATCH: "Despacho",
};

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

function bpsToPercentLabel(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export function SettingsForm({ initial }: SettingsFormProps) {
  const [state, formAction] = useActionState<SettingsActionState, FormData>(
    updateSettingsAction,
    initialSettingsState,
  );

  useEffect(() => {
    if (state.ok) {
      toast.success(state.message ?? "Configuración guardada.");
    } else if (state.message && !state.fieldErrors) {
      toast.error(state.message);
    }
  }, [state.ok, state.message, state.fieldErrors]);

  const costMethodOptions = useMemo(
    () =>
      Object.entries(COST_ALLOCATION_METHOD_LABELS) as Array<
        [CostAllocationMethod, string]
      >,
    [],
  );

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
                defaultChecked={initial.enabledShippingMethods.includes(value as ShippingMethod)}
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
                defaultChecked={initial.enabledPaymentMethods.includes(value as PaymentMethod)}
              />
            ))}
          </div>
          <FieldError message={state.fieldErrors?.enabledPaymentMethods} />
        </div>
        <Separator />
        <div>
          <p className="mb-2 text-sm font-medium">Comisión por medio de pago (%)</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Porcentaje que se descuenta de la utilidad cuando el pedido se paga
            con cada medio (0% = sin comisión).
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => {
              const bps = initial.paymentMethodFees[value as PaymentMethod] ?? 0;
              return (
                <div
                  key={value}
                  className="flex flex-col gap-1.5 rounded-md border border-border bg-card px-3 py-2"
                >
                  <label
                    htmlFor={`paymentMethodFee.${value}`}
                    className="text-xs font-medium text-muted-foreground"
                  >
                    {label}
                  </label>
                  <Input
                    id={`paymentMethodFee.${value}`}
                    name={`paymentMethodFee.${value}`}
                    type="number"
                    min={0}
                    max={10000}
                    step={1}
                    defaultValue={bps}
                    className="h-8"
                    aria-invalid={Boolean(
                      state.fieldErrors?.paymentMethodFees,
                    )}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Actual: {bpsToPercentLabel(bps)}
                  </p>
                </div>
              );
            })}
          </div>
          <FieldError message={state.fieldErrors?.paymentMethodFees} />
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
                defaultChecked={initial.paymentValidatorRoles.includes(value as Role)}
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

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Tipo de cambio"
          description="Conversión USD → PEN usada como base para costos importados."
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="defaultExchangeRate" className="text-sm font-medium">
              Tipo de cambio predeterminado (S/ por USD)
            </label>
            <Input
              id="defaultExchangeRate"
              name="defaultExchangeRate"
              type="text"
              inputMode="decimal"
              defaultValue={initial.defaultExchangeRate}
              required
              aria-invalid={Boolean(state.fieldErrors?.defaultExchangeRate)}
            />
            <p className="text-xs text-muted-foreground">
              Cada lote puede sobreescribirlo al registrar la compra.
            </p>
            <FieldError message={state.fieldErrors?.defaultExchangeRate} />
          </div>
        </SectionCard>

        <SectionCard
          title="Canales de venta"
          description="Canales disponibles al registrar un pedido."
        >
          <div>
            <p className="mb-2 text-sm font-medium">Canales habilitados</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(SALES_CHANNEL_LABELS).map(([value, label]) => (
                <CheckboxRow
                  key={value}
                  name="enabledSalesChannels"
                  value={value}
                  label={label}
                  defaultChecked={initial.enabledSalesChannels.includes(value as SalesChannel)}
                />
              ))}
            </div>
            <FieldError message={state.fieldErrors?.enabledSalesChannels} />
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Márgenes objetivo"
          description="Mínimo aceptable y objetivo recomendado (en porcentaje)."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="minimumTargetMarginBps" className="text-sm font-medium">
                Margen mínimo (%)
              </label>
              <Input
                id="minimumTargetMarginBps"
                name="minimumTargetMarginBps"
                type="number"
                min={0}
                max={10000}
                step={1}
                defaultValue={initial.minimumTargetMarginBps}
                required
                aria-invalid={Boolean(state.fieldErrors?.minimumTargetMarginBps)}
              />
              <p className="text-xs text-muted-foreground">
                Actual: {bpsToPercentLabel(initial.minimumTargetMarginBps)}
              </p>
              <FieldError message={state.fieldErrors?.minimumTargetMarginBps} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="objectiveTargetMarginBps" className="text-sm font-medium">
                Margen objetivo (%)
              </label>
              <Input
                id="objectiveTargetMarginBps"
                name="objectiveTargetMarginBps"
                type="number"
                min={0}
                max={10000}
                step={1}
                defaultValue={initial.objectiveTargetMarginBps}
                required
                aria-invalid={Boolean(state.fieldErrors?.objectiveTargetMarginBps)}
              />
              <p className="text-xs text-muted-foreground">
                Actual: {bpsToPercentLabel(initial.objectiveTargetMarginBps)}
              </p>
              <FieldError message={state.fieldErrors?.objectiveTargetMarginBps} />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Costos estándar"
          description="Costos fijos por empaque y método de asignación de costos adicionales."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="standardPackagingCostPen"
                className="text-sm font-medium"
              >
                Costo estándar de empaque (S/)
              </label>
              <Input
                id="standardPackagingCostPen"
                name="standardPackagingCostPen"
                type="text"
                inputMode="decimal"
                defaultValue={initial.standardPackagingCostPen}
                aria-invalid={Boolean(
                  state.fieldErrors?.standardPackagingCostPen,
                )}
              />
              <FieldError
                message={state.fieldErrors?.standardPackagingCostPen}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="defaultCostAllocationMethod"
                className="text-sm font-medium"
              >
                Método de asignación por defecto
              </label>
              <select
                id="defaultCostAllocationMethod"
                name="defaultCostAllocationMethod"
                defaultValue={initial.defaultCostAllocationMethod}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30"
                required
                aria-invalid={Boolean(
                  state.fieldErrors?.defaultCostAllocationMethod,
                )}
              >
                {costMethodOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <FieldError
                message={state.fieldErrors?.defaultCostAllocationMethod}
              />
            </div>
          </div>
          <Separator />
          <div>
            <p className="mb-2 text-sm font-medium">
              Porcentajes del método mixto
            </p>
            <p className="mb-3 text-xs text-muted-foreground">
              Se aplican sólo cuando el método seleccionado es Mixto. La suma
              debe ser 100.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="mixedValueAllocationPercent"
                  className="text-sm font-medium"
                >
                  Por valor de items (%)
                </label>
                <Input
                  id="mixedValueAllocationPercent"
                  name="mixedValueAllocationPercent"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  defaultValue={initial.mixedValueAllocationPercent}
                  aria-invalid={Boolean(
                    state.fieldErrors?.mixedValueAllocationPercent,
                  )}
                />
                <FieldError
                  message={state.fieldErrors?.mixedValueAllocationPercent}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="mixedWeightAllocationPercent"
                  className="text-sm font-medium"
                >
                  Por peso de items (%)
                </label>
                <Input
                  id="mixedWeightAllocationPercent"
                  name="mixedWeightAllocationPercent"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  defaultValue={initial.mixedWeightAllocationPercent}
                  aria-invalid={Boolean(
                    state.fieldErrors?.mixedWeightAllocationPercent,
                  )}
                />
                <FieldError
                  message={state.fieldErrors?.mixedWeightAllocationPercent}
                />
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="flex items-center justify-between gap-3">
        <FormMessage ok={state.ok} message={state.message} />
        <SubmitButton label="Guardar cambios" />
      </div>
    </form>
  );
}
