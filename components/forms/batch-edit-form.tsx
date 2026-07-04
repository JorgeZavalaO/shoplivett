"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";

import { SubmitButton } from "@/components/ui/submit-button";
import { FieldError } from "@/components/ui/field-error";
import { FormMessage } from "@/components/ui/form-message";
import { updateBatchAction, type BatchActionResult } from "@/actions/import-batches";

type Props = {
  batchId: string;
  defaultValues: {
    purchaseDate: string;
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
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="purchaseDate" className="text-sm font-medium">Fecha de compra</label>
          <input
            id="purchaseDate"
            name="purchaseDate"
            type="date"
            defaultValue={defaultValues.purchaseDate}
            className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
          />
          <FieldError message={state?.fieldErrors?.purchaseDate} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="text-sm font-medium">Estado</label>
          <select
            id="status"
            name="status"
            className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
          >
            <option value="">Sin cambios</option>
            <option value="PURCHASED">Comprado</option>
            <option value="IN_TRANSIT">En tránsito</option>
            <option value="COMPLETE">Completo</option>
            <option value="CLOSED">Cerrado</option>
          </select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="shopper" className="text-sm font-medium">Comprador/a</label>
          <input
            id="shopper"
            name="shopper"
            type="text"
            defaultValue={defaultValues.shopper}
            className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="agency" className="text-sm font-medium">Agencia</label>
          <input
            id="agency"
            name="agency"
            type="text"
            defaultValue={defaultValues.agency}
            className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="totalCostUsd" className="text-sm font-medium">Costo total USD</label>
          <input
            id="totalCostUsd"
            name="totalCostUsd"
            type="text"
            inputMode="decimal"
            defaultValue={defaultValues.totalCostUsd}
            className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
          />
          <FieldError message={state?.fieldErrors?.totalCostUsd} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="totalAdditionalCostsUsd" className="text-sm font-medium">Adicional USD</label>
          <input
            id="totalAdditionalCostsUsd"
            name="totalAdditionalCostsUsd"
            type="text"
            inputMode="decimal"
            defaultValue={defaultValues.totalAdditionalCostsUsd}
            className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="totalAdditionalCostsPen" className="text-sm font-medium">Adicional PEN</label>
          <input
            id="totalAdditionalCostsPen"
            name="totalAdditionalCostsPen"
            type="text"
            inputMode="decimal"
            defaultValue={defaultValues.totalAdditionalCostsPen}
            className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="exchangeRate" className="text-sm font-medium">Tipo de cambio</label>
        <input
          id="exchangeRate"
          name="exchangeRate"
          type="text"
          inputMode="decimal"
          defaultValue={defaultValues.exchangeRate}
          className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
        />
        <FieldError message={state?.fieldErrors?.exchangeRate} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="batchNotes" className="text-sm font-medium">Notas</label>
        <textarea
          id="batchNotes"
          name="notes"
          rows={3}
          defaultValue={defaultValues.notes}
          className="rounded-lg border border-input bg-transparent px-3 py-1.5 text-sm"
        />
      </div>
      <FormMessage ok={state?.ok} message={state?.message} />
      <SubmitButton label="Guardar cambios" savingLabel="Guardando…" />
    </form>
  );
}
