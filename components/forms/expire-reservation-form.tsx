"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  expireReservationAction,
  type ExpireOrderResult,
} from "@/actions/order-expiry";

const initial: ExpireOrderResult = { ok: false };

type Props = {
  orderId: string;
  orderNumber: string;
};

export function ExpireReservationForm({ orderId, orderNumber }: Props) {
  const router = useRouter();
  const [state, formAction] = useActionState<ExpireOrderResult, FormData>(
    expireReservationAction,
    initial,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (state.ok) {
      startTransition(() => router.refresh());
    }
  }, [state.ok, router]);

  const errorMessage = !state.ok ? submitError ?? state.message ?? null : null;
  const successMessage = state.ok ? state.message ?? null : null;

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        name="reason"
        rows={2}
        maxLength={500}
        placeholder="Motivo de cancelación (opcional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        aria-label="Motivo de cancelación"
      />
      {errorMessage ? (
        <p className="text-xs text-destructive">{errorMessage}</p>
      ) : null}
      {successMessage ? (
        <p className="text-xs text-emerald-600">{successMessage}</p>
      ) : null}
      <Button
        type="button"
        variant="destructive"
        className="w-full"
        onClick={() => {
          setSubmitError(null);
          setConfirmOpen(true);
        }}
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <AlertTriangle className="size-4" />
        )}
        Cancelar reserva
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(next) => {
          if (pending) return;
          setConfirmOpen(next);
          if (!next) setSubmitError(null);
        }}
        title={`Cancelar reserva ${orderNumber}`}
        description="Se liberará el stock reservado y se rechazarán los pagos pendientes del pedido. La acción queda registrada en auditoría."
        confirmLabel="Sí, cancelar reserva"
        cancelLabel="Volver"
        tone="destructive"
        pending={pending}
        onConfirm={() => {
          const fd = new FormData();
          fd.set("orderId", orderId);
          fd.set("reason", reason);
          startTransition(async () => {
            try {
              await formAction(fd);
              setConfirmOpen(false);
              setReason("");
            } catch (err) {
              console.error(err);
              setSubmitError(
                err instanceof Error
                  ? err.message
                  : "No se pudo cancelar la reserva.",
              );
            }
          });
        }}
      />
    </div>
  );
}
