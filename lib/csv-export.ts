import { NextResponse } from "next/server";

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

function neutralizeFormulaCell(raw: string): string {
  if (!raw) return raw;
  const first = raw[0];
  if (first === "=" || first === "+" || first === "-" || first === "@") {
    return `'${raw}`;
  }
  return raw;
}

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
  raw = neutralizeFormulaCell(raw);
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

const CSV_ENCODER = new TextEncoder();

function csvRow(columns: string[]): string {
  return columns.join(",") + "\r\n";
}

/**
 * Versión streaming de buildCsv. Emite el BOM + header + data rows +
 * CRLF final como un ReadableStream de Uint8Array, útil para respuestas
 * HTTP grandes sin materializar todo el CSV en memoria.
 */
export function buildCsvStream<T>(
  rows: T[],
  columns: Array<CsvColumn<T>>,
): ReadableStream<Uint8Array> {
  const headerLine = columns.map((c) => escapeCell(c.header));
  let index = 0;

  return new ReadableStream({
    start(controller) {
      // BOM UTF-8
      controller.enqueue(CSV_ENCODER.encode("\uFEFF"));
      // Header
      controller.enqueue(CSV_ENCODER.encode(csvRow(headerLine)));
    },
    pull(controller) {
      while (index < rows.length) {
        const row = rows[index++];
        const cells = columns.map((c) => escapeCell(c.value(row)));
        controller.enqueue(CSV_ENCODER.encode(csvRow(cells)));
        if (index >= rows.length) {
          controller.close();
          return;
        }
        // Salir del while cada ~100 filas para no bloquear el event loop
        if (index % 100 === 0) return;
      }
      controller.close();
    },
    cancel() {
      index = rows.length;
    },
  });
}

/**
 * Versión streaming que recibe un iterador o generador, ideal para
 * conjuntos grandes donde las filas se producen bajo demanda.
 */
export function buildCsvStreamFromIterator<T>(
  columns: Array<CsvColumn<T>>,
) {
  const headerLine = columns.map((c) => escapeCell(c.header));
  let started = false;

  return new TransformStream<string, Uint8Array>({
    start(controller) {
      controller.enqueue(CSV_ENCODER.encode("\uFEFF"));
      controller.enqueue(CSV_ENCODER.encode(csvRow(headerLine)));
    },
    transform(chunk, controller) {
      // chunk is a row emitter ID — not used directly
    },
  });
}

/**
 * Genera un nombre de archivo slug-friendly a partir de un prefijo y la
 * fecha actual. Ej: `reporte-ventas-2026-06-26.csv`.
 */
/**
 * Crea un NextResponse que emite el ReadableStream como attachment CSV.
 */
export function csvStreamResponse(
  section: string,
  stream: ReadableStream<Uint8Array>,
  filename?: string,
): NextResponse {
  const name = filename ?? csvFilename(`reporte-${section}`);
  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
      "Transfer-Encoding": "chunked",
    },
  });
}

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
