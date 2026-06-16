// Utilidades compartidas para conversión y formato de montos monetarios.
// Todas las operaciones internas usan centavos enteros (Cents) para evitar
// imprecisiones de punto flotante. Los strings hacia/desde la base de datos
// y los formularios siempre usan exactamente 2 decimales.

export type Cents = number;

export class MoneyError extends Error {
  constructor(
    message: string,
    public readonly code: "INVALID_AMOUNT" | "NEGATIVE_NOT_ALLOWED" = "INVALID_AMOUNT",
  ) {
    super(message);
    this.name = "MoneyError";
  }
}

function toRawString(
  value: string | number | { toString(): string } | null | undefined,
): string {
  if (value == null) return "0";
  if (typeof value === "string") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value.toString() : "0";
  return value.toString();
}

/**
 * Convierte un valor decimal (string, number, Decimal-like) a centavos enteros.
 * Si el valor es null/undefined, devuelve 0. Si no es un número válido, lanza MoneyError.
 * Preserva el signo negativo cuando `opts.allowNegative` es true.
 */
export function toCents(
  value: string | number | { toString(): string } | null | undefined,
  opts: { allowNegative?: boolean } = {},
): Cents {
  if (value == null) return 0;
  const raw = toRawString(value);
  const trimmed = raw.trim();
  if (trimmed === "") return 0;
  const isNegative = trimmed.startsWith("-");
  const unsigned = isNegative ? trimmed.slice(1) : trimmed;
  const num = Number(unsigned);
  if (!Number.isFinite(num)) {
    throw new MoneyError("Monto inválido.");
  }
  if (!opts.allowNegative && isNegative) {
    throw new MoneyError("El monto no puede ser negativo.");
  }
  const [whole, fraction = ""] = unsigned.split(".");
  const safeWhole = (whole || "0").replace(/[^0-9]/g, "") || "0";
  const safeFraction = (fraction || "")
    .replace(/[^0-9]/g, "")
    .padEnd(2, "0")
    .slice(0, 2);
  return (Number(safeWhole) * 100 + Number(safeFraction)) * (isNegative ? -1 : 1);
}

/**
 * Convierte centavos enteros a un string decimal con exactamente 2 decimales.
 * Soporta números negativos.
 */
export function centsToDecimalString(cents: Cents): string {
  const negative = cents < 0;
  const abs = negative ? -cents : cents;
  const whole = Math.trunc(abs / 100);
  const fraction = Math.trunc(abs % 100);
  const fracStr = String(fraction).padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fracStr}`;
}

/**
 * Suma una lista de valores (strings o números) en centavos de forma segura.
 * Ignora null/undefined y considera vacío como 0.
 */
export function sumCents(
  values: Array<string | number | { toString(): string } | null | undefined>,
): Cents {
  return values.reduce<number>(
    (acc, v) => acc + toCents(v, { allowNegative: true }),
    0,
  );
}
