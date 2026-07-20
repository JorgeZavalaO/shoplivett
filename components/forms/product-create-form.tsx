"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import {
  Camera,
  ImagePlus,
  Loader2,
  Package,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CancelLink } from "@/components/ui/cancel-link";
import { FieldError } from "@/components/ui/field-error";
import { FormMessage } from "@/components/ui/form-message";
import {
  createProductWithVariantsAction,
  type ProductCreateWithVariantsResult,
} from "@/actions/products";

type CategoryOption = {
  id: string;
  name: string;
  isActive: boolean;
};

type VariantRow = {
  id: string;
  color: string;
  material: string;
  size: string;
  price: string;
  cost: string;
  stock: string;
  barcode: string;
};

type Props = {
  categories: CategoryOption[];
  cancelHref: string;
};

const initialState: ProductCreateWithVariantsResult = { ok: false };

function makeVariantId(): string {
  return `v-${Math.random().toString(36).slice(2, 10)}`;
}

function emptyVariant(): VariantRow {
  return {
    id: makeVariantId(),
    color: "",
    material: "",
    size: "",
    price: "",
    cost: "",
    stock: "0",
    barcode: "",
  };
}

function FormSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="min-w-44">
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Creando producto…
        </>
      ) : (
        <>
          <Sparkles className="size-4" /> Crear producto
        </>
      )}
    </Button>
  );
}

export function ProductCreateForm({ categories, cancelHref }: Props) {
  const [state, formAction] = useActionState<
    ProductCreateWithVariantsResult,
    FormData
  >(createProductWithVariantsAction, initialState);
  const router = useRouter();
  const [hasVariants, setHasVariants] = useState(true);
  const [variants, setVariants] = useState<VariantRow[]>([emptyVariant()]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const lastErrorKey = useRef<string | null>(null);

  useEffect(() => {
    if (!imagePreview) return;
    return () => URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  useEffect(() => {
    if (state.ok || !state.message) return;
    const key = `${state.code ?? "UNKNOWN"}::${state.message}`;
    if (lastErrorKey.current === key) return;
    lastErrorKey.current = key;
    toast.error("No pudimos crear el producto", {
      description: state.message,
      duration: 6000,
    });
    router.refresh();
  }, [state, router]);

  const handleFormSubmit = useCallback(() => {
    lastErrorKey.current = null;
  }, []);

  const handleHasVariantsChange = useCallback(
    (next: boolean) => {
      setHasVariants(next);
      if (!next && variants.length > 1) {
        setVariants([variants[0]]);
      }
    },
    [variants],
  );

  const updateVariant = useCallback(
    (id: string, patch: Partial<Omit<VariantRow, "id">>) => {
      setVariants((prev) =>
        prev.map((v) => (v.id === id ? { ...v, ...patch } : v)),
      );
    },
    [],
  );

  const addVariant = useCallback(() => {
    setVariants((prev) => [...prev, emptyVariant()]);
  }, []);

  const removeVariant = useCallback((id: string) => {
    setVariants((prev) => prev.filter((v) => v.id !== id));
  }, []);

  const onImageChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      if (!file) {
        setImageFile(null);
        setImagePreview(null);
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    },
    [],
  );

  const clearImage = useCallback(() => {
    setImageFile(null);
    setImagePreview(null);
  }, []);

  const variantsForSubmit = useMemo(
    () =>
      variants.map((v) => ({
        color: v.color.trim() || undefined,
        material: v.material.trim() || undefined,
        size: v.size.trim() || undefined,
        price: v.price.trim(),
        cost: v.cost.trim() || undefined,
        stock: v.stock.trim() || "0",
        barcode: v.barcode.trim() || undefined,
      })),
    [variants],
  );

  return (
    <form
      action={(fd) => {
        fd.set("variants", JSON.stringify(variantsForSubmit));
        fd.set("hasVariants", hasVariants ? "true" : "false");
        if (imageFile) {
          fd.set("image", imageFile);
        } else {
          fd.delete("image");
        }
        formAction(fd);
      }}
      onSubmit={handleFormSubmit}
      className="flex flex-col gap-6"
      noValidate
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="size-4 text-muted-foreground" />
            1 · Producto
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-sm font-medium">
              Nombre del modelo *
            </label>
            <Input
              id="name"
              name="name"
              required
              maxLength={120}
              placeholder="Cartera Valentina"
              aria-invalid={Boolean(state.fieldErrors?.name)}
            />
            <FieldError message={state.fieldErrors?.name} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="categoryId" className="text-sm font-medium">
              Categoría *
            </label>
            <select
              id="categoryId"
              name="categoryId"
              required
              defaultValue=""
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="" disabled>
                Selecciona una categoría
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.isActive ? "" : " (inactiva)"}
                </option>
              ))}
            </select>
            <FieldError message={state.fieldErrors?.categoryId} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="description" className="text-sm font-medium">
              Descripción
            </label>
            <textarea
              id="description"
              name="description"
              maxLength={2000}
              rows={3}
              placeholder="Detalles del modelo, materiales, etc."
              className="min-h-20 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <FieldError message={state.fieldErrors?.description} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-muted-foreground" />
            2 · Variantes
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hasVariants}
              onChange={(e) => handleHasVariantsChange(e.target.checked)}
              className="size-4 accent-primary"
            />
            Este producto tiene varias variantes (colores, tallas, etc.)
          </label>

          <p className="text-[11px] text-muted-foreground">
            El código de cada variante se genera automáticamente. Stock inicial
            es opcional (queda en 0 si lo dejas vacío).
          </p>
          <FieldError message={state.fieldErrors?.variants} />

          <div className="flex flex-col gap-3">
            {variants.map((variant, index) => (
              <div
                key={variant.id}
                className="grid gap-3 rounded-xl border border-border/70 bg-muted/20 p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Variante {index + 1}
                  </p>
                  {hasVariants && variants.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Eliminar variante ${index + 1}`}
                      onClick={() => removeVariant(variant.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Color
                    </label>
                    <Input
                      value={variant.color}
                      onChange={(e) => updateVariant(variant.id, { color: e.target.value })}
                      maxLength={60}
                      placeholder="Negro"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Material
                    </label>
                    <Input
                      value={variant.material}
                      onChange={(e) => updateVariant(variant.id, { material: e.target.value })}
                      maxLength={60}
                      placeholder="Cuero"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Talla
                    </label>
                    <Input
                      value={variant.size}
                      onChange={(e) => updateVariant(variant.id, { size: e.target.value })}
                      maxLength={60}
                      placeholder="M"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Precio (S/)
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">S/</span>
                      <Input
                        value={variant.price}
                        onChange={(e) => updateVariant(variant.id, { price: e.target.value })}
                        inputMode="decimal"
                        placeholder="0.00"
                        className="pl-8"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">Déjalo en 0 si aún no defines el precio. Podrás asignarlo después desde el lote.</p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Costo (S/)
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">S/</span>
                      <Input
                        value={variant.cost}
                        onChange={(e) => updateVariant(variant.id, { cost: e.target.value })}
                        inputMode="decimal"
                        placeholder="opcional"
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Stock inicial
                    </label>
                    <Input
                      value={variant.stock}
                      onChange={(e) => updateVariant(variant.id, { stock: e.target.value })}
                      inputMode="numeric"
                      placeholder="0"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
                    <label className="text-xs font-medium text-muted-foreground">
                      Código de barras
                    </label>
                    <Input
                      value={variant.barcode}
                      onChange={(e) => updateVariant(variant.id, { barcode: e.target.value })}
                      maxLength={40}
                      placeholder="opcional"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {hasVariants ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={addVariant}
            >
              <Plus className="size-4" /> Agregar variante
            </Button>
          ) : (
            <p className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              Se creará una única variante con el precio y stock que definas aquí.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="size-4 text-muted-foreground" />
            3 · Foto del producto
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Una imagen principal (opcional). Formatos: PNG, JPEG o WebP. Máx 5 MB.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <label
              htmlFor="image"
              className="relative flex h-40 w-full cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed border-border bg-muted/30 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/50 sm:w-40"
            >
              {imagePreview ? (
                <Image
                  src={imagePreview}
                  alt="Vista previa"
                  fill
                  unoptimized
                  className="object-cover"
                  sizes="160px"
                />
              ) : (
                <>
                  <ImagePlus className="size-6" />
                  <span>Subir imagen</span>
                </>
              )}
              <input
                id="image"
                name="image"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={onImageChange}
                className="sr-only"
              />
            </label>

            <div className="flex flex-1 flex-col gap-2 text-xs text-muted-foreground">
              {imagePreview ? (
                <>
                  <p className="font-medium text-foreground">
                    {imageFile?.name}
                  </p>
                  <p>
                    {imageFile ? `${Math.round(imageFile.size / 1024)} KB` : ""}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-fit"
                    onClick={clearImage}
                  >
                    <X className="size-4" /> Quitar imagen
                  </Button>
                </>
              ) : (
                <p>
                  Esta imagen se mostrará en el catálogo y en la venta rápida.
                  Si no subes una ahora, podrás hacerlo después desde la
                  página del producto.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <FormMessage ok={state.ok} message={state.message} />
        <div className="flex items-center gap-2">
          <CancelLink href={cancelHref} />
          <FormSubmitButton />
        </div>
      </div>
    </form>
  );
}
