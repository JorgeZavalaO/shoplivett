"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { refundCreditAction, type CreditActionResult } from "@/actions/credits";

type Props = {
  creditId: string;
  onSuccess?: () => void;
};

export function RefundCreditForm({ creditId, onSuccess }: Props) {
  const [state, formAction] = useActionState<CreditActionResult | undefined, FormData>(
    async (_prev, formData) => {
      const result = await refundCreditAction(_prev, formData);
      if (result.ok) {
        onSuccess?.();
      }
      return result;
    },
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="creditId" value={creditId} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="refundReason" className="text-sm font-medium">Motivo *</label>
        <textarea
          id="refundReason"
          name="reason"
          rows={3}
          className="rounded-lg border border-input bg-transparent px-3 py-1.5 text-sm"
          placeholder="Indica el motivo de la devolución (mín. 5 caracteres)"
          required
        />
      </div>
      <FormMessage ok={state?.ok} message={state?.message} />
      <SubmitButton label="Confirmar devolución" savingLabel="Procesando…" />
    </form>
  );
}
