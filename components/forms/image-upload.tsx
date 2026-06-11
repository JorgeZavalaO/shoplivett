"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { uploadProductImageAction } from "@/actions/products";

type Props = {
  productId: string;
  variantId?: string | null;
  onUploaded?: () => void;
};

export function ImageUpload({ productId, variantId, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const result = await uploadProductImageAction(
        productId,
        variantId ?? null,
        fd,
      );
      if (result.ok) {
        toast.success(result.message ?? "Imagen subida.");
        onUploaded?.();
        router.refresh();
      } else {
        toast.error(result.message ?? "No se pudo subir la imagen.");
      }
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={onChange}
        className="hidden"
        disabled={pending}
      />
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        render={
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {pending ? "Subiendo…" : "Subir imagen"}
          </button>
        }
      />
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <ImageIcon className="size-3" /> PNG, JPEG o WebP. Máx 5 MB.
      </p>
    </div>
  );
}
