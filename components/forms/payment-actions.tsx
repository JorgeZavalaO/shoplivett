"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
  const router = useRouter();
  const [state, formAction] = useActionState<PaymentActionResult, FormData>(
    async (prev, fd) =>
      validatePaymentAction({
        paymentId,
        excessTreatment: String(fd.get("excessTreatment") ?? "REJECT") as
          | "CREDIT"
          | "REFUND"
          | "REJECT",
        excessNotes: String(fd.get("excessNotes") ?? "") || undefined,
      }),
    initialState,
  );
  const [rejectState, rejectFormAction] = useActionState<PaymentActionResult, FormData>(
    rejectPaymentAction,
    initialState,
  );
  const [showReject, setShowReject] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [excessMode, setExcessMode] = useState<"NONE" | "CREDIT" | "REFUND">("NONE");
  const [pending, startTransition] = useTransition();
  const [rejectPending, startRejectTransition] = useTransition();
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [rejectError, setRejectError] = useState<string | null>(null);

  useEffect(() => {
    if (state.ok) {
      startTransition(() => router.refresh());
    }
  }, [state.ok, router]);

  useEffect(() => {
    if (rejectState.ok) {
      startRejectTransition(() => router.refresh());
    }
  }, [rejectState.ok, router]);

  if (!canValidate) {
    return (
      <p className="text-xs text-muted-foreground">
        Tu rol no está autorizado para validar pagos.
      </p>
    );
  }

  const canChooseExcess = allowCredit || allowRefund;
  const validatePending = pending;
  const rejectBusy = rejectPending;
  const confirmMessage =
    !state.ok && state.message
      ? confirmError ?? state.message
      : confirmError;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
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
      </div>

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
        <div className="flex flex-col gap-2">
          <label className="text-xs text-muted-foreground">
            Motivo de rechazo
          </label>
          <Textarea
            rows={2}
            maxLength={500}
            placeholder="Captura ilegible, monto incorrecto…"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          {rejectError ? (
            <p className="text-xs text-destructive">{rejectError}</p>
          ) : null}
          {rejectState.ok && rejectState.message ? (
            <p className="text-xs text-emerald-600">{rejectState.message}</p>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowReject(false);
                setRejectReason("");
                setRejectError(null);
              }}
              className="flex-1"
              disabled={rejectBusy}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="flex-1"
              disabled={rejectBusy || rejectReason.trim().length < 5}
              onClick={() => {
                setRejectError(null);
                setConfirmReject(true);
              }}
            >
              Continuar
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmReject}
        onOpenChange={(next) => {
          if (rejectBusy) return;
          setConfirmReject(next);
          if (!next) setRejectError(null);
        }}
        title="Rechazar pago"
        description="El pago quedará como RECHAZADO y no modificará saldos ni stock. La acción queda registrada en auditoría."
        confirmLabel="Sí, rechazar pago"
        cancelLabel="Volver"
        tone="destructive"
        pending={rejectBusy}
        onConfirm={() => {
          const fd = new FormData();
          fd.set("paymentId", paymentId);
          fd.set("reason", rejectReason);
          startRejectTransition(async () => {
            try {
              await rejectFormAction(fd);
              setConfirmReject(false);
              setShowReject(false);
              setRejectReason("");
            } catch (err) {
              console.error(err);
              setRejectError(
                err instanceof Error
                  ? err.message
                  : "No se pudo rechazar el pago.",
              );
            }
          });
        }}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(next) => {
          if (validatePending) return;
          setConfirmOpen(next);
          if (!next) setConfirmError(null);
        }}
        title="Validar pago"
        description={
          <>
            Al validar, los pedidos aplicados se marcan como pagados, se
            mueven al stock vendido y, si hay excedente, se registra como
            crédito o devolución según la opción elegida.
            {confirmMessage ? (
              <span
                role="alert"
                className="mt-2 block rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-xs"
              >
                {confirmMessage}
              </span>
            ) : null}
          </>
        }
        confirmLabel={
          excessMode === "CREDIT"
            ? "Validar y crear crédito"
            : excessMode === "REFUND"
              ? "Validar y registrar devolución"
              : "Validar pago"
        }
        cancelLabel="Cancelar"
        pending={validatePending}
        onConfirm={() => {
          const fd = new FormData();
          fd.set("paymentId", paymentId);
          fd.set("excessTreatment", excessMode === "NONE" ? "REJECT" : excessMode);
          startTransition(async () => {
            try {
              await formAction(fd);
              setConfirmOpen(false);
              setConfirmError(null);
            } catch (err) {
              console.error(err);
              setConfirmError(
                err instanceof Error
                  ? err.message
                  : "No se pudo validar el pago.",
              );
            }
          });
        }}
      />
      {state.ok && state.message && !confirmOpen ? (
        <p className="rounded-md bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-700">
          {state.message}
        </p>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        onClick={() => setConfirmOpen(true)}
        disabled={validatePending}
      >
        <Check className="size-4" /> Confirmar validación
      </Button>
    </div>
  );
}
