"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  rejectPaymentAction,
  validatePaymentAction,
  type PaymentActionResult,
} from "@/actions/payments";

const initialState: PaymentActionResult = { ok: false };

function ValidateButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Validando…" : label}
    </Button>
  );
}

function RejectSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending} className="w-full">
      {pending ? "Rechazando…" : "Confirmar rechazo"}
    </Button>
  );
}

type Props = {
  paymentId: string;
  canValidate: boolean;
  allowCredit: boolean;
  allowRefund: boolean;
};

export function PaymentActions({
  paymentId,
  canValidate,
  allowCredit,
  allowRefund,
}: Props) {
  const [state, formAction] = useActionState<PaymentActionResult, FormData>(
    async (prev, fd) =>
      validatePaymentAction(
        paymentId,
        String(fd.get("excessTreatment") ?? "REJECT") as
          | "CREDIT"
          | "REFUND"
          | "REJECT",
        String(fd.get("excessNotes") ?? "") || undefined,
      ),
    initialState,
  );
  const [rejectState, rejectFormAction] = useActionState<PaymentActionResult, FormData>(
    rejectPaymentAction,
    initialState,
  );
  const [showReject, setShowReject] = useState(false);
  const [excessMode, setExcessMode] = useState<"NONE" | "CREDIT" | "REFUND">("NONE");
  const [, startTransition] = useTransition();

  if (!canValidate) {
    return (
      <p className="text-xs text-muted-foreground">
        Tu rol no está autorizado para validar pagos.
      </p>
    );
  }

  const canChooseExcess = allowCredit || allowRefund;

  return (
    <div className="flex flex-col gap-3">
      <form
        action={(fd) => {
          fd.set("excessTreatment", excessMode === "NONE" ? "REJECT" : excessMode);
          startTransition(() => formAction(fd));
        }}
        className="flex flex-col gap-2"
      >
        {canChooseExcess ? (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">
              Excedente por sobrepago
            </label>
            <select
              name="excessTreatment"
              value={excessMode}
              onChange={(e) =>
                setExcessMode(e.target.value as "NONE" | "CREDIT" | "REFUND")
              }
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
            >
              <option value="NONE">No permitir (rechazar si hay excedente)</option>
              {allowCredit ? <option value="CREDIT">Registrar como crédito</option> : null}
              {allowRefund ? <option value="REFUND">Registrar como devolución</option> : null}
            </select>
            {excessMode !== "NONE" ? (
              <textarea
                name="excessNotes"
                rows={2}
                maxLength={500}
                placeholder="Nota del excedente (opcional)"
                className="mt-1 min-h-12 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            ) : null}
          </div>
        ) : null}
        <ValidateButton
          label={excessMode === "CREDIT" ? "Validar y crear crédito" : "Validar pago"}
        />
      </form>
      {state.message ? (
        <p
          className={
            state.ok
              ? "rounded-md bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-700"
              : "rounded-md bg-destructive/10 px-3 py-1.5 text-xs text-destructive"
          }
        >
          {state.message}
        </p>
      ) : null}

      {!showReject ? (
        <Button
          type="button"
          variant="outline"
          className="text-destructive"
          onClick={() => setShowReject(true)}
        >
          <X className="size-4" /> Rechazar pago
        </Button>
      ) : (
        <form action={rejectFormAction} className="flex flex-col gap-2">
          <input type="hidden" name="paymentId" value={paymentId} />
          <label className="text-xs text-muted-foreground">
            Motivo de rechazo
          </label>
          <Textarea
            name="reason"
            rows={2}
            maxLength={500}
            placeholder="Captura ilegible, monto incorrecto…"
            required
          />
          {rejectState.message ? (
            <p className="text-xs text-destructive">{rejectState.message}</p>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowReject(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <RejectSubmit />
          </div>
        </form>
      )}
    </div>
  );
}
