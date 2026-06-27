"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Calculator, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { recalculateBatchAction } from "@/actions/import-batches";

type Props = {
  batchId: string;
};

export function RecalculateBatchButton({ batchId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleConfirm() {
    startTransition(async () => {
      const result = await recalculateBatchAction(batchId);
      if (result.ok) {
        toast.success("Costos recalculados", {
          description: `${result.itemCount} items. Total aterrizado: S/ ${result.totalLandedPen}.`,
        });
        setOpen(false);
        router.refresh();
      } else {
        toast.error("No se pudo recalcular", { description: result.message });
      }
    });
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      title="Recalcular costos aterrizados"
      description="Esta acción redistribuye los costos adicionales del lote (por valor, peso o mixto según configuración) entre los items y actualiza el costo unitario real. Se registrará en la auditoría."
      confirmLabel={isPending ? "Recalculando..." : "Recalcular"}
      tone="default"
      onConfirm={handleConfirm}
      trigger={
        <Button variant="secondary" size="sm" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Recalculando...
            </>
          ) : (
            <>
              <Calculator className="size-4" /> Recalcular costos
            </>
          )}
        </Button>
      }
    />
  );
}
