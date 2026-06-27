// Constantes y tipos de import-batches seguros para cliente.
// NO importar nada de Prisma aquí (este archivo se usa también en componentes client).

import type { ImportBatchStatus } from "@prisma/client";

export const IMPORT_BATCH_STATUS_LABELS: Record<ImportBatchStatus, string> = {
  PURCHASED: "Comprado",
  IN_TRANSIT: "En tránsito",
  COMPLETE: "Completo",
  CLOSED: "Cerrado",
};

export const BATCH_STATUS_OPTIONS: Array<{ value: ImportBatchStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "Todos" },
  { value: "PURCHASED", label: "Comprados" },
  { value: "IN_TRANSIT", label: "En tránsito" },
  { value: "COMPLETE", label: "Completos" },
  { value: "CLOSED", label: "Cerrados" },
];
