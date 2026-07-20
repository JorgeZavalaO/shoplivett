"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Calculator } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from "@/components/ui/dialog";
import { BatchEditForm } from "@/components/forms/batch-edit-form";
import { AddBatchItemForm } from "@/components/forms/add-batch-item-form";

type Props = {
  batchId: string;
  isClosed: boolean;
  defaultValues: {
    purchaseDate: string;
    estimatedArrivalDate: string;
    shopper: string;
    agency: string;
    totalCostUsd: string;
    totalAdditionalCostsUsd: string;
    totalAdditionalCostsPen: string;
    exchangeRate: string;
    notes: string;
  };
};

export function BatchDetailActions({ batchId, isClosed, defaultValues }: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);

  function handleSuccess() {
    setEditOpen(false);
    setAddItemOpen(false);
    router.refresh();
  }

  if (isClosed) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogTrigger render={<Button size="sm" variant="outline" />}>
          <Pencil className="size-4" /> Editar
        </DialogTrigger>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Editar lote</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <BatchEditForm batchId={batchId} defaultValues={defaultValues} onSuccess={handleSuccess} />
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogTrigger render={<Button size="sm" variant="outline" />}>
          <Plus className="size-4" /> Agregar producto
        </DialogTrigger>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Agregar producto al lote</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <AddBatchItemForm batchId={batchId} onSuccess={handleSuccess} />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
}
