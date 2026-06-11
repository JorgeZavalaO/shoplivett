"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

function StatusSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Actualizando…
        </>
      ) : (
        label
      )}
    </Button>
  );
}

function CancelSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending} className="w-full">
      {pending ? "Cancelando…" : "Confirmar cancelación"}
    </Button>
  );
}

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
  const [, startTransition] = useTransition();

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
        <form
          key={t}
          action={(fd) => {
            startTransition(() => formAction(fd));
          }}
        >
          <input type="hidden" name="shipmentId" value={shipmentId} />
          <input type="hidden" name="to" value={t} />
          <StatusSubmit label={NEXT_LABELS[t] ?? `Pasar a ${t}`} />
        </form>
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
          />
          {cancelState.message ? (
            <p className="text-xs text-destructive">{cancelState.message}</p>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowCancel(false)}
              className="flex-1"
            >
              Volver
            </Button>
            <CancelSubmit />
          </div>
        </form>
      )}
      {state.ok || cancelState.ok ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => startTransition(() => router.refresh())}
        >
          Refrescar
        </Button>
      ) : null}
    </div>
  );
}
