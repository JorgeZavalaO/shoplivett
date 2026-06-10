// Helper para Vercel Blob. Se implementa en Sprint 4 (subida de imágenes).
export const BLOB_ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export type BlobAcceptedType = (typeof BLOB_ACCEPTED_TYPES)[number];

export function isBlobAcceptedType(value: string): value is BlobAcceptedType {
  return (BLOB_ACCEPTED_TYPES as readonly string[]).includes(value);
}
