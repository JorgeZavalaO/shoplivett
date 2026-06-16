"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deactivateCustomerAction } from "@/actions/customers";

type Props = {
  customerId: string;
  customerName: string;
};

export function DeactivateCustomerButton({ customerId, customerName }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        await deactivateCustomerAction(customerId);
        setOpen(false);
        router.refresh();
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo dar de baja a la clienta. Intenta nuevamente.",
        );
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="text-destructive"
        onClick={() => setOpen(true)}
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <UserX className="size-4" />
        )}
        Dar de baja
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          if (!pending) {
            setOpen(next);
            if (!next) setError(null);
          }
        }}
        title={`Dar de baja a ${customerName}`}
        description={
          <>
            La clienta quedará inactiva. No se eliminará su historial de
            pedidos, pagos ni envíos, pero no aparecerá en listados ni
            buscadores por defecto.
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
        confirmLabel="Sí, dar de baja"
        cancelLabel="Cancelar"
        tone="destructive"
        pending={pending}
        onConfirm={handleConfirm}
      />
    </>
  );
}
