"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Power, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cancelLiveAction, closeLiveAction } from "@/actions/lives";

type Props = {
  liveId: string;
  liveName: string;
};

export function LiveLifecycleActions({ liveId, liveName }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"close" | "cancel" | null>(null);

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        setDialog(null);
        router.refresh();
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo actualizar el live. Intenta nuevamente.",
        );
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setError(null);
          setDialog("close");
        }}
        disabled={pending}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Power className="size-4" />}
        Cerrar live
      </Button>
      <Button
        type="button"
        variant="outline"
        className="text-destructive"
        onClick={() => {
          setError(null);
          setDialog("cancel");
        }}
        disabled={pending}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
        Cancelar
      </Button>
      <ConfirmDialog
        open={dialog === "close"}
        onOpenChange={(next) => {
          if (!pending) {
            setDialog(next ? "close" : null);
            if (!next) setError(null);
          }
        }}
        title={`Cerrar ${liveName}`}
        description={
          <>
            Al cerrar el live ya no se podrán registrar pedidos en esta sesión.
            La acción queda registrada en auditoría.
            {error ? (
              <span
                role="alert"
                className="mt-2 block rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-xs"
              >
                {error}
              </span>
            ) : null}
          </>
        }
        confirmLabel="Cerrar live"
        cancelLabel="Mantener abierto"
        pending={pending}
        onConfirm={() => {
          void run(() => closeLiveAction(liveId));
        }}
      />
      <ConfirmDialog
        open={dialog === "cancel"}
        onOpenChange={(next) => {
          if (!pending) {
            setDialog(next ? "cancel" : null);
            if (!next) setError(null);
          }
        }}
        title={`Cancelar ${liveName}`}
        description={
          <>
            El live quedará en estado cancelado. Esta acción no elimina los
            pedidos ya asociados, pero bloquea nuevas ventas.
            {error ? (
              <span
                role="alert"
                className="mt-2 block rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-xs"
              >
                {error}
              </span>
            ) : null}
          </>
        }
        confirmLabel="Sí, cancelar live"
        cancelLabel="Volver"
        tone="destructive"
        pending={pending}
        onConfirm={() => {
          void run(() => cancelLiveAction(liveId));
        }}
      />
    </>
  );
}
