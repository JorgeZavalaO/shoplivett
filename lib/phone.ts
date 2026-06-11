// Normalización y validación de números de WhatsApp peruanos (E.164).

const PERU_DIAL_CODE = "51";
const NATIONAL_LENGTH = 9;

/**
 * Normaliza un input de WhatsApp al formato canónico E.164 peruano: +519XXXXXXXXX.
 * Devuelve null si no se puede normalizar a un número válido.
 *
 * Reglas:
 *  - Elimina todo lo que no sea dígito.
 *  - Quita un 0 inicial si existe.
 *  - Si el resultado tiene 9 dígitos, se asume Perú y se antepone +51.
 *  - Si el resultado tiene 11 dígitos y comienza con 51, se formatea como +51XXXXXXXXX.
 *  - Si el resultado tiene 12 dígitos y comienza con 51, se formatea como +51XXXXXXXXX (descarta el 1 extra si existe).
 *  - El primer dígito nacional debe ser 9.
 */
export function normalizeWhatsApp(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return null;

  if (digits.length === NATIONAL_LENGTH && digits.startsWith("9")) {
    return `+${PERU_DIAL_CODE}${digits}`;
  }

  if (digits.length === 11 && digits.startsWith(PERU_DIAL_CODE)) {
    const national = digits.slice(PERU_DIAL_CODE.length);
    if (national.startsWith("9") && national.length === NATIONAL_LENGTH) {
      return `+${PERU_DIAL_CODE}${national}`;
    }
  }

  if (digits.length === 12 && digits.startsWith(`${PERU_DIAL_CODE}1`)) {
    const national = digits.slice(PERU_DIAL_CODE.length + 1);
    if (national.startsWith("9") && national.length === NATIONAL_LENGTH) {
      return `+${PERU_DIAL_CODE}${national}`;
    }
  }

  return null;
}

export function isValidPeruWhatsApp(value: string | null | undefined): boolean {
  return normalizeWhatsApp(value) !== null;
}

/** Da formato legible: +51 999 999 999. */
export function formatWhatsAppDisplay(value: string | null | undefined): string {
  const normalized = normalizeWhatsApp(value);
  if (!normalized) return value ?? "";
  const dial = normalized.slice(0, 3); // +51
  const a = normalized.slice(3, 6);
  const b = normalized.slice(6, 9);
  const c = normalized.slice(9, 12);
  return `${dial} ${a} ${b} ${c}`.trim();
}

/** Quita acentos/diacríticos y pasa a minúsculas. Usado para searchName. */
export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}
