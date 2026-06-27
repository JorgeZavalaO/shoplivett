// Utilidad para generar archivos CSV a partir de filas tabulares.
//
// Toda la salida opera con strings para evitar perdida de precision en
// montos monetarios (los valores ya vienen en formato decimal con 2
// decimales). El BOM UTF-8 se incluye para que Excel reconozca acentos
// al abrir el archivo.

export type CsvCell = string | number | boolean | Date | null | undefined;

export type CsvColumn<T> = {
  header: string;
  value: (row: T) => CsvCell;
};

function escapeCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  let raw: string;
  if (value instanceof Date) {
    raw = value.toISOString();
  } else if (typeof value === "boolean") {
    raw = value ? "true" : "false";
  } else if (typeof value === "number") {
    raw = Number.isFinite(value) ? String(value) : "";
  } else {
    raw = String(value);
  }
  if (
    raw.includes('"') ||
    raw.includes(",") ||
    raw.includes("\n") ||
    raw.includes("\r")
  ) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

/**
 * Construye el contenido de un archivo CSV (con BOM UTF-8 y CRLF) a
 * partir de un set de filas y un mapa de columnas.
 */
export function buildCsv<T>(rows: T[], columns: Array<CsvColumn<T>>): string {
  const headerLine = columns.map((c) => escapeCell(c.header)).join(",");
  const lines = [headerLine];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCell(c.value(row))).join(","));
  }
  // CRLF para maxima compatibilidad con Excel en Windows.
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

/**
 * Genera un nombre de archivo slug-friendly a partir de un prefijo y la
 * fecha actual. Ej: `reporte-ventas-2026-06-26.csv`.
 */
export function csvFilename(prefix: string, date: Date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10);
  const slug = prefix
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "reporte"}-${stamp}.csv`;
}

/**
 * Helper para convertir un valor en centavos a string decimal sin usar
 * `toCents`/`centsToDecimalString` (evita acoplar este modulo con money).
 */
export function centsToCsv(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return "";
  return centsToDecimalStringLocal(cents);
}

function centsToDecimalStringLocal(cents: number): string {
  const negative = cents < 0;
  const abs = negative ? -cents : cents;
  const whole = Math.trunc(abs / 100);
  const fraction = Math.trunc(abs % 100);
  return `${negative ? "-" : ""}${whole}.${String(fraction).padStart(2, "0")}`;
}
