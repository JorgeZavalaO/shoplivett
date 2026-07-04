"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BatchEditForm } from "@/components/forms/batch-edit-form";
import { AddBatchItemForm } from "@/components/forms/add-batch-item-form";

type Props = {
  batchId: string;
  isClosed: boolean;
  defaultValues: {
    purchaseDate: string;
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
  const [showEdit, setShowEdit] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);

  function handleSuccess() {
    setShowEdit(false);
    setShowAddItem(false);
    router.refresh();
  }

  if (isClosed) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" onClick={() => setShowEdit(!showEdit)}>
        <Pencil className="size-4" /> Editar
      </Button>
      <Button size="sm" variant="outline" onClick={() => setShowAddItem(!showAddItem)}>
        <Plus className="size-4" /> Agregar producto
      </Button>

      {showEdit && (
        <div className="w-full rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-medium">Editar lote</h3>
          <BatchEditForm batchId={batchId} defaultValues={defaultValues} onSuccess={handleSuccess} />
        </div>
      )}

      {showAddItem && (
        <div className="w-full rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-medium">Agregar producto al lote</h3>
          <AddBatchItemForm batchId={batchId} onSuccess={handleSuccess} />
        </div>
      )}
    </div>
  );
}
