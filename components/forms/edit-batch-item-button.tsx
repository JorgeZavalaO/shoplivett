"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError } from "@/components/ui/field-error";
import { FormMessage } from "@/components/ui/form-message";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  updateBatchItemAction,
  type BatchActionResult,
} from "@/actions/import-batches";

type ItemData = {
  id: string;
  productName: string;
  variantCode: string;
  quantityPurchased: number;
  quantityReceived: number;
  unitCostUsd: string;
  weight: string;
};

type Props = {
  batchId: string;
  item: ItemData;
};

const initialState: BatchActionResult = { ok: false };

export function EditBatchItemButton({ batchId, item }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [fields, setFields] = useState({
    quantityReceived: String(item.quantityReceived),
    unitCostUsd: item.unitCostUsd,
    weight: item.weight,
  });

  const [state, formAction] = useActionState<BatchActionResult, FormData>(
    async (_prev, formData) => {
      const result = await updateBatchItemAction(batchId, item.id, _prev, formData);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    initialState,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="ghost" />}>
        <Pencil className="size-4" />
      </DialogTrigger>
      <DialogContent size="md">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Editar producto del lote</DialogTitle>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            <div className="rounded-lg bg-muted/30 px-3 py-2 text-sm">
              <p className="font-medium">{item.productName}</p>
              <p className="font-mono text-xs text-muted-foreground">{item.variantCode}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-muted-foreground">
                  Comprados
                </label>
                <p className="text-sm font-medium">{item.quantityPurchased}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ebi-received" className="text-sm font-medium">
                  Recibidos *
                </label>
                <Input
                  id="ebi-received"
                  name="quantityReceived"
                  type="number"
                  min={0}
                  max={item.quantityPurchased}
                  value={fields.quantityReceived}
                  onChange={(e) => setFields((prev) => ({ ...prev, quantityReceived: e.target.value }))}
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Máx {item.quantityPurchased} (comprados). No puede ser menor a las unidades ya vendidas.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ebi-cost" className="text-sm font-medium">
                  Costo unit. USD
                </label>
                <Input
                  id="ebi-cost"
                  name="unitCostUsd"
                  inputMode="decimal"
                  step="0.0001"
                  placeholder="0.0000"
                  value={fields.unitCostUsd}
                  onChange={(e) => setFields((prev) => ({ ...prev, unitCostUsd: e.target.value }))}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ebi-weight" className="text-sm font-medium">
                  Peso (kg)
                </label>
                <Input
                  id="ebi-weight"
                  name="weight"
                  inputMode="decimal"
                  step="0.0001"
                  placeholder="0"
                  value={fields.weight}
                  onChange={(e) => setFields((prev) => ({ ...prev, weight: e.target.value }))}
                />
              </div>
            </div>

            <FieldError message={state.fieldErrors?.items} />
            <FormMessage ok={state.ok} message={state.message} />
          </DialogBody>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit">Guardar cambios</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
