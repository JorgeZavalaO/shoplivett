"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";

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
  quickCreateProductAction,
  type QuickCreateProductResult,
} from "@/actions/products";

type CategoryOption = {
  id: string;
  name: string;
  isActive: boolean;
};

type VariantInfo = {
  id: string;
  code: string;
  productId: string;
  productName: string;
};

type Props = {
  categories: CategoryOption[];
  onSuccess: (variant: VariantInfo) => void;
};

const initialState: QuickCreateProductResult = { ok: false };

export function QuickProductDialog({ categories, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<
    QuickCreateProductResult,
    FormData
  >(async (_prev, formData) => {
    const result = await quickCreateProductAction(_prev, formData);
    if (result.ok && result.variantId) {
      onSuccess({
        id: result.variantId,
        code: result.variantCode ?? "",
        productId: result.productId ?? "",
        productName: result.productName ?? "",
      });
      setOpen(false);
    }
    return result;
  }, initialState);

  const activeCategories = categories.filter((c) => c.isActive);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Plus className="size-4" />
        Crear producto
      </DialogTrigger>
      <DialogContent size="lg">
        <form
          action={formAction}
          onSubmit={() => {
            /* noop — formAction handles it */
          }}
        >
          <DialogHeader>
            <DialogTitle>Crear producto rápido</DialogTitle>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="qp-name" className="text-sm font-medium">
                Nombre del producto *
              </label>
              <Input
                id="qp-name"
                name="name"
                required
                maxLength={120}
                placeholder="Nombre del modelo"
                aria-invalid={Boolean(state.fieldErrors?.name)}
              />
              <FieldError message={state.fieldErrors?.name} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="qp-category" className="text-sm font-medium">
                Categoría *
              </label>
              <select
                id="qp-category"
                name="categoryId"
                required
                defaultValue=""
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                aria-invalid={Boolean(state.fieldErrors?.categoryId)}
              >
                <option value="" disabled>
                  Selecciona una categoría
                </option>
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <FieldError message={state.fieldErrors?.categoryId} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="qp-color" className="text-sm font-medium">
                  Color
                </label>
                <Input
                  id="qp-color"
                  name="color"
                  maxLength={60}
                  placeholder="Negro"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="qp-size" className="text-sm font-medium">
                  Talla
                </label>
                <Input
                  id="qp-size"
                  name="size"
                  maxLength={60}
                  placeholder="Única"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="qp-price" className="text-sm font-medium">
                  Precio (S/)
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">S/</span>
                  <Input
                    id="qp-price"
                    name="price"
                    inputMode="decimal"
                    placeholder="0.00"
                    className="pl-8"
                    aria-invalid={Boolean(state.fieldErrors?.price)}
                  />
                </div>
                <FieldError message={state.fieldErrors?.price} />
                <p className="text-[11px] text-muted-foreground">Déjalo en 0 si aún no tienes precio de venta definido.</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="qp-cost" className="text-sm font-medium">
                  Costo (S/)
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">S/</span>
                  <Input
                    id="qp-cost"
                    name="cost"
                    inputMode="decimal"
                    placeholder="opcional"
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="qp-stock" className="text-sm font-medium">
                  Stock inicial
                </label>
                <Input
                  id="qp-stock"
                  name="stock"
                  inputMode="numeric"
                  type="number"
                  min={0}
                  defaultValue="0"
                />
              </div>
            </div>

            <FormMessage ok={state.ok} message={state.message} />
          </DialogBody>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit">Crear producto</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
