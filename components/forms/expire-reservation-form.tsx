"use client";

import { useActionState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  expireReservationAction,
  type ExpireOrderResult,
} from "@/actions/order-expiry";

const initial: ExpireOrderResult = { ok: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending} className="w-full">
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Cancelando…
        </>
      ) : (
        <>
          <X className="size-4" /> Confirmar cancelación
        </>
      )}
    </Button>
  );
}

type Props = {
  orderId: string;
};

export function ExpireReservationForm({ orderId }: Props) {
  const router = useRouter();
  const [state, formAction] = useActionState<ExpireOrderResult, FormData>(
    expireReservationAction,
    initial,
  );
  const [, startTransition] = useTransition();

  if (state.ok) {
    // Tras éxito, refrescar la lista de vencidos.
    if (typeof window !== "undefined") {
      startTransition(() => router.refresh());
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <Textarea
        name="reason"
        rows={2}
        maxLength={500}
        placeholder="Motivo de cancelación (opcional)"
      />
      {state.message && !state.ok ? (
        <p className="text-xs text-destructive">{state.message}</p>
      ) : null}
      {state.ok ? (
        <p className="text-xs text-emerald-600">{state.message}</p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
