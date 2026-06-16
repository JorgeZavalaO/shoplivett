"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Power, PowerOff, Star, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  deleteImageAction,
  setPrimaryImageAction,
  setProductActiveAction,
  setVariantStatusAction,
} from "@/actions/products";

type Props = {
  productId: string;
  productName: string;
  isActive: boolean;
  images: { id: string; url: string; isPrimary: boolean }[];
  variants: { id: string; status: "ACTIVE" | "HIDDEN" | "ARCHIVED" }[];
};

const VARIANT_STATUS_LABELS: Record<"ACTIVE" | "HIDDEN" | "ARCHIVED", string> = {
  ACTIVE: "Activa",
  HIDDEN: "Oculta",
  ARCHIVED: "Archivada",
};

export function ProductLifecycleActions({
  productId,
  productName,
  isActive,
  images,
  variants,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [pendingImageDelete, setPendingImageDelete] = useState<{
    id: string;
    url: string;
  } | null>(null);

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo aplicar el cambio. Intenta nuevamente.",
        );
      }
    });
  }

  function runAndClose(action: () => Promise<void>, onClose: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        onClose();
        router.refresh();
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo aplicar el cambio. Intenta nuevamente.",
        );
      }
    });
  }

  function handleVariantStatus(variantId: string, status: "ACTIVE" | "HIDDEN" | "ARCHIVED") {
    run(() => setVariantStatusAction(variantId, status));
  }

  function handlePrimary(imageId: string) {
    run(() => setPrimaryImageAction(imageId));
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={isActive ? "text-amber-700" : "text-emerald-700"}
        onClick={() => {
          setError(null);
          setConfirmToggle(true);
        }}
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : isActive ? (
          <PowerOff className="size-4" />
        ) : (
          <Power className="size-4" />
        )}
        {isActive ? "Desactivar" : "Activar"}
      </Button>

      <div className="grid gap-3">
        {variants.map((v) => (
          <div
            key={v.id}
            className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="grid gap-1">
              <p className="font-mono text-sm font-semibold">{v.id.slice(0, 8)}</p>
              <p className="text-xs text-muted-foreground">
                Estado actual: {VARIANT_STATUS_LABELS[v.status]}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                defaultValue={v.status}
                disabled={pending}
                onChange={(e) =>
                  handleVariantStatus(
                    v.id,
                    e.target.value as "ACTIVE" | "HIDDEN" | "ARCHIVED",
                  )
                }
                className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                aria-label="Cambiar estado de variante"
              >
                {(Object.keys(VARIANT_STATUS_LABELS) as Array<keyof typeof VARIANT_STATUS_LABELS>).map(
                  (key) => (
                    <option key={key} value={key}>
                      {VARIANT_STATUS_LABELS[key]}
                    </option>
                  ),
                )}
              </select>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((img) => (
          <div
            key={img.id}
            className="overflow-hidden rounded-lg border border-border bg-card"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt="Imagen del producto"
              className="aspect-square w-full object-cover"
            />
            <div className="flex items-center justify-between gap-2 p-2">
              <span className="text-xs">
                {img.isPrimary ? "Principal" : "Secundaria"}
              </span>
              <div className="flex items-center gap-1">
                {!img.isPrimary ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label="Marcar como principal"
                    disabled={pending}
                    onClick={() => handlePrimary(img.id)}
                  >
                    <Star className="size-3" />
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label="Eliminar imagen"
                  className="text-destructive"
                  disabled={pending}
                  onClick={() => {
                    setError(null);
                    setPendingImageDelete({ id: img.id, url: img.url });
                  }}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
        >
          {error}
        </p>
      ) : null}

      <ConfirmDialog
        open={confirmToggle}
        onOpenChange={(next) => {
          if (!pending) {
            setConfirmToggle(next);
            if (!next) setError(null);
          }
        }}
        title={
          isActive
            ? `Desactivar ${productName}`
            : `Activar ${productName}`
        }
        description={
          isActive
            ? "El producto dejará de mostrarse en listados y ventas. Podrás reactivarlo cuando quieras."
            : "El producto volverá a estar disponible para ventas y listados."
        }
        confirmLabel={isActive ? "Sí, desactivar" : "Sí, activar"}
        cancelLabel="Cancelar"
        tone={isActive ? "destructive" : "default"}
        pending={pending}
        onConfirm={() =>
          runAndClose(
            () => setProductActiveAction(productId, !isActive),
            () => setConfirmToggle(false),
          )
        }
      />

      <ConfirmDialog
        open={pendingImageDelete !== null}
        onOpenChange={(next) => {
          if (!pending) {
            if (!next) setPendingImageDelete(null);
            setError(null);
          }
        }}
        title="Eliminar imagen"
        description="La imagen se borrará de Vercel Blob y de la base de datos. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        tone="destructive"
        pending={pending}
        onConfirm={() => {
          if (!pendingImageDelete) return;
          const target = pendingImageDelete;
          runAndClose(
            () => deleteImageAction(target.id),
            () => setPendingImageDelete(null),
          );
        }}
      />
    </>
  );
}
