"use client";

import { useActionState, useRef } from "react";

import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { FieldError } from "@/components/ui/field-error";
import { createManualCreditAction, type CreditActionResult } from "@/actions/credits";

type Props = {
  customerId: string;
  onSuccess?: () => void;
};

export function CreateManualCreditForm({ customerId, onSuccess }: Props) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState<CreditActionResult | undefined, FormData>(
    async (_prev, formData) => {
      const result = await createManualCreditAction(_prev, formData);
      if (result.ok) {
        ref.current?.reset();
        onSuccess?.();
      }
      return result;
    },
    undefined,
  );

  return (
    <form action={formAction} ref={ref} className="flex flex-col gap-3">
      <input type="hidden" name="customerId" value={customerId} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="amount" className="text-sm font-medium">Monto S/</label>
        <input
          id="amount"
          name="amount"
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
          required
        />
        <FieldError message={state?.fieldErrors?.amount} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="notes" className="text-sm font-medium">Notas</label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          className="rounded-lg border border-input bg-transparent px-3 py-1.5 text-sm"
          placeholder="Motivo del crédito (opcional)"
        />
      </div>
      <FormMessage ok={state?.ok} message={state?.message} />
      <SubmitButton label="Registrar crédito" savingLabel="Registrando…" />
    </form>
  );
}
