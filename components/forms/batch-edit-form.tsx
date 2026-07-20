"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { FieldError } from "@/components/ui/field-error";
import { FormMessage } from "@/components/ui/form-message";
import { updateBatchAction, type BatchActionResult } from "@/actions/import-batches";

type Props = {
  batchId: string;
  defaultValues: {
    purchaseDate: string;
    estimatedArrivalDate: string;
    shopper: string;
    agency: string;
    totalCostUsd: string;
    totalAdditionalCostsUsd: string;
    totalAdditionalCostsPen: string;
    exchangeRate: string;
    notes: string;
  };
  onSuccess?: () => void;
};

export function BatchEditForm({ batchId, defaultValues, onSuccess }: Props) {
  const router = useRouter();

  const [fields, setFields] = useState({
    purchaseDate: defaultValues.purchaseDate,
    estimatedArrivalDate: defaultValues.estimatedArrivalDate,
    shopper: defaultValues.shopper,
    agency: defaultValues.agency,
    totalCostUsd: defaultValues.totalCostUsd,
    totalAdditionalCostsUsd: defaultValues.totalAdditionalCostsUsd,
    totalAdditionalCostsPen: defaultValues.totalAdditionalCostsPen,
    exchangeRate: defaultValues.exchangeRate,
    notes: defaultValues.notes,
  });
  const [status, setStatus] = useState("");

  function updateField(name: keyof typeof fields, value: string) {
    setFields((prev) => ({ ...prev, [name]: value }));
  }

  const [state, formAction] = useActionState<BatchActionResult | undefined, FormData>(
    async (_prev, formData) => {
      const result = await updateBatchAction(batchId, _prev, formData);
      if (result.ok) {
        onSuccess?.();
        router.refresh();
      }
      return result;
    },
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-purchaseDate" className="text-sm font-medium">
            Fecha de compra
          </label>
          <Input
            id="edit-purchaseDate"
            name="purchaseDate"
            type="date"
            value={fields.purchaseDate}
            onChange={(e) => updateField("purchaseDate", e.target.value)}
            aria-invalid={Boolean(state?.fieldErrors?.purchaseDate)}
          />
          <FieldError message={state?.fieldErrors?.purchaseDate} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-estimatedArrivalDate" className="text-sm font-medium">
            Fecha estimada de llegada
          </label>
          <Input
            id="edit-estimatedArrivalDate"
            name="estimatedArrivalDate"
            type="date"
            value={fields.estimatedArrivalDate}
            onChange={(e) => updateField("estimatedArrivalDate", e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">Fecha estimada en que los productos llegarán al almacén.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-status" className="text-sm font-medium">
            Estado
          </label>
          <select
            id="edit-status"
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">Mantener actual</option>
            <option value="PURCHASED">Comprado</option>
            <option value="IN_TRANSIT">En tránsito</option>
            <option value="COMPLETE">Completo</option>
            <option value="CLOSED">Cerrado</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-shopper" className="text-sm font-medium">
            Shopper
          </label>
          <Input
            id="edit-shopper"
            name="shopper"
            maxLength={100}
            placeholder="Nombre del shopper"
            value={fields.shopper}
            onChange={(e) => updateField("shopper", e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">Persona que realizó la compra en el exterior.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-agency" className="text-sm font-medium">
            Agencia
          </label>
          <Input
            id="edit-agency"
            name="agency"
            maxLength={100}
            placeholder="Nombre de la agencia"
            value={fields.agency}
            onChange={(e) => updateField("agency", e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">Nombre del courier o agencia de importación.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-totalCostUsd" className="text-sm font-medium">
            Costo total USD
          </label>
          <Input
            id="edit-totalCostUsd"
            name="totalCostUsd"
            inputMode="decimal"
            placeholder="0.00"
            value={fields.totalCostUsd}
            onChange={(e) => updateField("totalCostUsd", e.target.value)}
            aria-invalid={Boolean(state?.fieldErrors?.totalCostUsd)}
          />
          <FieldError message={state?.fieldErrors?.totalCostUsd} />
          <p className="text-[11px] text-muted-foreground">Debe coincidir con la suma del costo de todos los productos del lote.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-totalAdditionalCostsUsd" className="text-sm font-medium">
            Adicionales USD
          </label>
          <Input
            id="edit-totalAdditionalCostsUsd"
            name="totalAdditionalCostsUsd"
            inputMode="decimal"
            placeholder="0.00"
            value={fields.totalAdditionalCostsUsd}
            onChange={(e) => updateField("totalAdditionalCostsUsd", e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">Gastos en dólares (flete, seguro, etc.).</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-totalAdditionalCostsPen" className="text-sm font-medium">
            Adicionales PEN
          </label>
          <Input
            id="edit-totalAdditionalCostsPen"
            name="totalAdditionalCostsPen"
            inputMode="decimal"
            placeholder="0.00"
            value={fields.totalAdditionalCostsPen}
            onChange={(e) => updateField("totalAdditionalCostsPen", e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">Gastos en soles no asignados a un producto.</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-exchangeRate" className="text-sm font-medium">
          Tipo de cambio (USD → PEN)
        </label>
        <Input
          id="edit-exchangeRate"
          name="exchangeRate"
          inputMode="decimal"
          placeholder="3.75"
          value={fields.exchangeRate}
          onChange={(e) => updateField("exchangeRate", e.target.value)}
          aria-invalid={Boolean(state?.fieldErrors?.exchangeRate)}
        />
        <FieldError message={state?.fieldErrors?.exchangeRate} />
        <p className="text-[11px] text-muted-foreground">Si cambia, se invalidarán los costos calculados y se recalcularán automáticamente.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-notes" className="text-sm font-medium">
          Notas
        </label>
        <textarea
          id="edit-notes"
          name="notes"
          rows={3}
          maxLength={1000}
          className="min-h-20 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          placeholder="Notas del lote..."
          value={fields.notes}
          onChange={(e) => updateField("notes", e.target.value)}
        />
      </div>

      <FormMessage ok={state?.ok} message={state?.message} />
      <SubmitButton label="Guardar cambios" savingLabel="Guardando…" />
    </form>
  );
}
