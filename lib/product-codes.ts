// Generación de códigos únicos para variantes de producto.
// Formato: PREFIX-CAT-COLOR-NNNN (ej. CART-MANO-NEG-0001)

const MAX_ATTEMPTS = 10;
const PADDING = 4;

function normalizeForCode(value: string | null | undefined): string {
  if (!value) return "X";
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 4) || "X";
}

export function buildVariantCode(
  prefix: string,
  categorySlug: string,
  color: string | null | undefined,
  suffix: number,
): string {
  const safePrefix = normalizeForCode(prefix);
  const safeCategory = normalizeForCode(categorySlug);
  const safeColor = normalizeForCode(color);
  const padded = String(suffix).padStart(PADDING, "0");
  return `${safePrefix}-${safeCategory}-${safeColor}-${padded}`;
}

/**
 * Devuelve el siguiente sufijo disponible para la combinación
 * prefix + categorySlug + color, basándose en los códigos existentes.
 */
export function nextAvailableSuffix(
  existingCodes: string[],
  prefix: string,
  categorySlug: string,
  color: string | null | undefined,
): number {
  const safePrefix = normalizeForCode(prefix);
  const safeCategory = normalizeForCode(categorySlug);
  const safeColor = normalizeForCode(color);
  const prefixPart = `${safePrefix}-${safeCategory}-${safeColor}-`;

  let max = 0;
  for (const code of existingCodes) {
    if (code.startsWith(prefixPart)) {
      const tail = code.slice(prefixPart.length);
      const n = Number.parseInt(tail, 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return max + 1;
}

export { MAX_ATTEMPTS, normalizeForCode };
