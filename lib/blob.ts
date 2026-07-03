// Helper para Vercel Blob. Sprint 4 introduce uploadImage con validación.
import { put, del, get } from "@vercel/blob";

export const BLOB_ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export type BlobAcceptedType = (typeof BLOB_ACCEPTED_TYPES)[number];

export const BLOB_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export function isBlobAcceptedType(value: string): value is BlobAcceptedType {
  return (BLOB_ACCEPTED_TYPES as readonly string[]).includes(value);
}

export type UploadedImage = {
  url: string;
  pathname: string;
  size: number;
  contentType: string;
};

type UploadImageOptions = {
  access?: "public" | "private";
};

export class ImageUploadError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "MISSING_FILE"
      | "INVALID_TYPE"
      | "TOO_LARGE"
      | "MISSING_TOKEN"
      | "UPLOAD_FAILED",
  ) {
    super(message);
    this.name = "ImageUploadError";
  }
}

function extensionFor(contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/webp") return "webp";
  return "bin";
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/**
 * Sube una imagen a Vercel Blob.
 * Valida tipo y tamaño antes de transferir.
 */
export async function uploadImage(
  file: File | Blob,
  folder: string,
  filenameHint?: string,
  options?: UploadImageOptions,
): Promise<UploadedImage> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new ImageUploadError(
      "Falta configurar BLOB_READ_WRITE_TOKEN en el entorno.",
      "MISSING_TOKEN",
    );
  }
  if (!file || file.size === 0) {
    throw new ImageUploadError("No se recibió ningún archivo.", "MISSING_FILE");
  }
  const contentType = (file as File).type || "application/octet-stream";
  if (!isBlobAcceptedType(contentType)) {
    throw new ImageUploadError(
      "Tipo de archivo no permitido. Usa PNG, JPEG o WebP.",
      "INVALID_TYPE",
    );
  }
  if (file.size > BLOB_MAX_BYTES) {
    throw new ImageUploadError(
      "La imagen supera el tamaño máximo de 5 MB.",
      "TOO_LARGE",
    );
  }

  const safeFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, "").replace(/^\/+|\/+$/g, "");
  const ext = extensionFor(contentType);
  const base = filenameHint
    ? filenameHint.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "image"
    : "image";
  const pathname = `${safeFolder}/${base}-${randomSuffix()}.${ext}`;

  try {
    const result = await put(pathname, file, {
      access: options?.access ?? "public",
      addRandomSuffix: false,
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return {
      url: result.url,
      pathname: result.pathname,
      size: file.size,
      contentType,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    throw new ImageUploadError(
      `No se pudo subir la imagen: ${message}`,
      "UPLOAD_FAILED",
    );
  }
}

export async function getImage(
  pathname: string,
  access: "public" | "private",
) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  return get(pathname, {
    access,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
}

export async function deleteImage(pathname: string): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    await del(pathname, { token: process.env.BLOB_READ_WRITE_TOKEN });
  } catch {
    // Silenciar: un delete fallido no debe romper el flujo principal.
  }
}
