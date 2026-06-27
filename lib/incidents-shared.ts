// Constantes y tipos de Incidents seguros para cliente.
// NO importar nada de Prisma aquí (este archivo se usa también en componentes client).

import type { IncidentReturnDecision, IncidentStatus, IncidentType } from "@prisma/client";

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  RETURN: "Devolucion",
  DAMAGE: "Producto danado",
  LOSS: "Perdida",
  CLAIM: "Reclamo",
  EXCHANGE: "Cambio",
};

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  OPEN: "Abierta",
  RESOLVED: "Resuelta",
  CANCELLED: "Cancelada",
};

export const INCIDENT_DECISION_LABELS: Record<IncidentReturnDecision, string> = {
  RESTOCK: "Volver a stock",
  CREDIT: "Emitir credito",
  REPLACE: "Reemplazar",
  DISCARDED: "Solo registro",
  NONE: "No aplica",
};

export const INCIDENT_TYPE_OPTIONS: Array<{ value: IncidentType; label: string }> = (
  Object.keys(INCIDENT_TYPE_LABELS) as IncidentType[]
).map((key) => ({ value: key, label: INCIDENT_TYPE_LABELS[key] }));

export const INCIDENT_STATUS_OPTIONS: Array<{ value: IncidentStatus; label: string }> = (
  Object.keys(INCIDENT_STATUS_LABELS) as IncidentStatus[]
).map((key) => ({ value: key, label: INCIDENT_STATUS_LABELS[key] }));

export const INCIDENT_STATUS_VALUES: IncidentStatus[] = [
  "OPEN",
  "RESOLVED",
  "CANCELLED",
];

export const INCIDENT_DECISION_OPTIONS: Array<{
  value: IncidentReturnDecision;
  label: string;
}> = (Object.keys(INCIDENT_DECISION_LABELS) as IncidentReturnDecision[]).map(
  (key) => ({ value: key, label: INCIDENT_DECISION_LABELS[key] }),
);

export const RETURN_DECISIONS: IncidentReturnDecision[] = [
  "RESTOCK",
  "CREDIT",
  "REPLACE",
  "DISCARDED",
];

export function decisionRequiresVariant(decision: IncidentReturnDecision): boolean {
  return decision === "RESTOCK";
}

export function decisionRequiresCredit(decision: IncidentReturnDecision): boolean {
  return decision === "CREDIT";
}
