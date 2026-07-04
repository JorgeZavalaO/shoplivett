"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { removeBatchItemAction } from "@/actions/import-batches";

type Props = {
  batchId: string;
  itemId: string;
  productName: string;
};

export function RemoveBatchItemButton({ batchId, itemId, productName }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleConfirm() {
    startTransition(async () => {
      try {
        await removeBatchItemAction(batchId, itemId);
        toast.success("Item eliminado", {
          description: `${productName} fue eliminado del lote.`,
        });
        setOpen(false);
        router.refresh();
      } catch {
        toast.error("No se pudo eliminar el item.", {
          description: "Tiene ventas o reservas asociadas.",
        });
      }
    });
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      title="Eliminar producto del lote"
      description={
        <>
          Eliminar <strong>{productName}</strong> del lote revertirá el stock
          correspondiente. Esta operación no afecta ventas ya registradas.
        </>
      }
      confirmLabel={isPending ? "Eliminando…" : "Eliminar"}
      tone="destructive"
      pending={isPending}
      onConfirm={handleConfirm}
      trigger={
        <Button size="sm" variant="ghost" className="text-destructive">
          <Trash2 className="size-4" />
        </Button>
      }
    />
  );
}
