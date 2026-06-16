"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  cancelShipmentAction,
  changeShipmentStatusAction,
  type ShipmentActionResult,
} from "@/actions/shipments";

const initial: ShipmentActionResult = { ok: false };

const NEXT_LABELS: Record<string, string> = {
  PREPARING: "Marcar preparando",
  READY: "Marcar como listo",
  SHIPPED: "Marcar como enviado",
  DELIVERED: "Marcar como entregado",
};

type Status =
  | "PENDING"
  | "PREPARING"
  | "READY"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

type Props = {
  shipmentId: string;
  status: Status;
  availableTransitions: Status[];
};

const ALL_TRANSITIONS: Status[] = [
  "PREPARING",
  "READY",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];

export function ShipmentStatusActions({
  shipmentId,
  status,
  availableTransitions,
}: Props) {
  const router = useRouter();
  const [state, formAction] = useActionState<ShipmentActionResult, FormData>(
    changeShipmentStatusAction,
    initial,
  );
  const [cancelState, cancelFormAction] = useActionState<ShipmentActionResult, FormData>(
    cancelShipmentAction,
    initial,
  );
  const [showCancel, setShowCancel] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmTransition, setConfirmTransition] = useState<Status | null>(null);
  const [reason, setReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (cancelState.ok) {
      startTransition(() => router.refresh());
    }
  }, [cancelState.ok, router]);

  useEffect(() => {
    if (state.ok) {
      startTransition(() => router.refresh());
    }
  }, [state.ok, router]);

  if (status === "DELIVERED" || status === "CANCELLED") {
    return (
      <p className="text-xs text-muted-foreground">
        El envío ya está en estado final.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {ALL_TRANSITIONS.filter(
        (t) => t !== "CANCELLED" && availableTransitions.includes(t),
      ).map((t) => (
        <Button
          key={t}
          type="button"
          variant="outline"
          onClick={() => {
            setTransitionError(null);
            setConfirmTransition(t);
          }}
        >
          {NEXT_LABELS[t] ?? `Pasar a ${t}`}
        </Button>
      ))}

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

      {!showCancel ? (
        <Button
          type="button"
          variant="outline"
          className="text-destructive"
          onClick={() => setShowCancel(true)}
        >
          Cancelar envío
        </Button>
      ) : (
        <form action={cancelFormAction} className="flex flex-col gap-2">
          <input type="hidden" name="shipmentId" value={shipmentId} />
          <Textarea
            name="reason"
            rows={2}
            maxLength={500}
            placeholder="Motivo de cancelación (opcional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          {cancelState.message && !cancelState.ok ? (
            <p className="text-xs text-destructive">{cancelState.message}</p>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowCancel(false);
                setReason("");
              }}
              className="flex-1"
            >
              Volver
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="flex-1"
              onClick={() => {
                setCancelError(null);
                setConfirmCancel(true);
              }}
            >
              Confirmar cancelación
            </Button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={(next) => {
          if (!pending) {
            setConfirmCancel(next);
            if (!next) setCancelError(null);
          }
        }}
        title="Cancelar envío"
        description="El envío volverá a estado Cancelado y los pedidos asociados quedarán disponibles para un nuevo envío. Esta acción queda registrada en auditoría."
        confirmLabel="Sí, cancelar envío"
        cancelLabel="Volver"
        tone="destructive"
        pending={pending}
        onConfirm={() => {
          const fd = new FormData();
          fd.set("shipmentId", shipmentId);
          fd.set("reason", reason);
          startTransition(async () => {
            try {
              await cancelFormAction(fd);
              setConfirmCancel(false);
              setShowCancel(false);
              setReason("");
            } catch (err) {
              console.error(err);
              setCancelError(
                err instanceof Error
                  ? err.message
                  : "No se pudo cancelar el envío.",
              );
            }
          });
        }}
      />
      {cancelError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs text-destructive"
        >
          {cancelError}
        </p>
      ) : null}

      <ConfirmDialog
        open={confirmTransition !== null}
        onOpenChange={(next) => {
          if (!pending) {
            setConfirmTransition(next ? confirmTransition : null);
            if (!next) setTransitionError(null);
          }
        }}
        title={
          confirmTransition
            ? `Marcar envío como ${NEXT_LABELS[confirmTransition]?.replace("Marcar como ", "") ?? confirmTransition}`
            : "Cambiar estado"
        }
        description={
          confirmTransition === "DELIVERED"
            ? "Esta acción marca el envío como entregado y no puede deshacerse. Confirma que la clienta recibió sus pedidos."
            : "Confirma el cambio de estado. La acción queda registrada en auditoría."
        }
        confirmLabel="Confirmar"
        cancelLabel="Cancelar"
        tone={confirmTransition === "DELIVERED" ? "destructive" : "default"}
        pending={pending}
        onConfirm={() => {
          if (!confirmTransition) return;
          const target = confirmTransition;
          const fd = new FormData();
          fd.set("shipmentId", shipmentId);
          fd.set("to", target);
          startTransition(async () => {
            try {
              await formAction(fd);
              setConfirmTransition(null);
            } catch (err) {
              console.error(err);
              setTransitionError(
                err instanceof Error
                  ? err.message
                  : "No se pudo cambiar el estado.",
              );
            }
          });
        }}
      />
      {transitionError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs text-destructive"
        >
          {transitionError}
        </p>
      ) : null}
    </div>
  );
}
