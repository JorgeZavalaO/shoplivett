"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { resolveIncidentAction, type IncidentActionResult } from "@/actions/incidents";

type Props = {
  incidentId: string;
};

export function ResolveIncidentButton({ incidentId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    const fd = new FormData();
    if (notes.trim()) fd.set("resolutionNotes", notes.trim());
    startTransition(async () => {
      const result: IncidentActionResult = await resolveIncidentAction(
        incidentId,
        undefined,
        fd,
      );
      if (result.ok) {
        toast.success("Incidencia resuelta", { description: result.message });
        setOpen(false);
        setNotes("");
        router.refresh();
      } else {
        toast.error("No se pudo resolver", { description: result.message });
      }
    });
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (isPending) return;
        if (!next) setNotes("");
        setOpen(next);
      }}
      title="Resolver incidencia"
      description={
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Marca la incidencia como resuelta. Las integraciones con stock,
            creditos y movimientos ya fueron aplicadas al crearla.
          </p>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="resolutionNotes"
              className="text-sm font-medium"
            >
              Notas de resolucion
            </label>
            <textarea
              id="resolutionNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Opcional"
              className="min-h-20 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              disabled={isPending}
            />
          </div>
        </div>
      }
      confirmLabel={isPending ? "Resolviendo..." : "Resolver"}
      tone="default"
      onConfirm={handleConfirm}
      pending={isPending}
      trigger={
        <Button variant="default" size="sm" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Resolviendo...
            </>
          ) : (
            <>
              <CheckCircle2 className="size-4" /> Resolver
            </>
          )}
        </Button>
      }
    />
  );
}
