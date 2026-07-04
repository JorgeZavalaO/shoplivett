// Helper para Vercel Blob. Sprint 4 introduce uploadImage con validación.
import { put, del, get } from "@vercel/blob";

export const BLOB_ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export type BlobAcceptedType = (typeof BLOB_ACCEPTED_TYPES)[number];

export const BLOB_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const BLOB_MAX_FILES_PER_ACTION = 5;
export const BLOB_MAX_TOTAL_BYTES = 15 * 1024 * 1024; // 15 MB

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
      | "INVALID_SIGNATURE"
      | "TOO_LARGE"
      | "TOO_MANY_FILES"
      | "TOTAL_TOO_LARGE"
      | "MISSING_TOKEN"
      | "UPLOAD_FAILED",
  ) {
    super(message);
    this.name = "ImageUploadError";
  }
}

function matchesSignature(contentType: string, bytes: Uint8Array): boolean {
  if (contentType === "image/png") {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }
  if (contentType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/webp") {
    return (
      bytes.length >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    );
  }
  return false;
}

async function assertImageSignature(file: File | Blob, contentType: string): Promise<void> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!matchesSignature(contentType, bytes)) {
    throw new ImageUploadError(
      "El archivo no coincide con una imagen PNG, JPEG o WebP valida.",
      "INVALID_SIGNATURE",
    );
  }
}

export function validateImageBatch(
  files: Array<File | Blob>,
  options?: {
    maxFiles?: number;
    maxTotalBytes?: number;
  },
): void {
  const nonEmptyFiles = files.filter((file) => file.size > 0);
  const maxFiles = options?.maxFiles ?? BLOB_MAX_FILES_PER_ACTION;
  const maxTotalBytes = options?.maxTotalBytes ?? BLOB_MAX_TOTAL_BYTES;

  if (nonEmptyFiles.length > maxFiles) {
    throw new ImageUploadError(
      `Solo puedes subir hasta ${maxFiles} archivo(s) por accion.`,
      "TOO_MANY_FILES",
    );
  }

  const totalBytes = nonEmptyFiles.reduce((acc, file) => acc + file.size, 0);
  if (totalBytes > maxTotalBytes) {
    throw new ImageUploadError(
      `El tamano total de archivos supera el maximo de ${Math.floor(maxTotalBytes / (1024 * 1024))} MB por accion.`,
      "TOTAL_TOO_LARGE",
    );
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
  await assertImageSignature(file, contentType);

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
