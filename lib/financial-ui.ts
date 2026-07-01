// Helpers cliente-seguros para clasificar riesgo y rentabilidad financiera.
// No depende de Prisma ni de APIs de servidor; puede reutilizarse desde
// dashboard, reportes, lotes y formularios client.

import {
  MARGIN_BPS_HIGH_THRESHOLD,
  MARGIN_BPS_LOW_THRESHOLD,
} from "@/lib/financial-dashboard-shared";

export type MarginLevel = "loss" | "low" | "medium" | "high";
export type BatchHealthLevel = "pending" | "loss" | "low" | "medium" | "high";
export type StockHealthLevel = "out" | "low" | "healthy";
export type RotationLevel = "fresh" | "aging" | "stale" | "never";
export type IncidentImpactLevel = "cancelled" | "neutral" | "warning" | "loss" | "recovered";

export function classifyMarginBps(bps: number): MarginLevel {
  if (bps < 0) return "loss";
  if (bps < MARGIN_BPS_LOW_THRESHOLD) return "low";
  if (bps < MARGIN_BPS_HIGH_THRESHOLD) return "medium";
  return "high";
}

export function classifyMarginPercent(percent: number): MarginLevel {
  return classifyMarginBps(Math.round(percent * 100));
}

export function formatBpsPercent(bps: number, decimals = 1): string {
  return `${(bps / 100).toFixed(decimals)}%`;
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function marginLabel(level: MarginLevel): string {
  switch (level) {
    case "loss":
      return "Pérdida";
    case "low":
      return "Margen bajo";
    case "medium":
      return "Margen medio";
    case "high":
      return "Margen alto";
  }
}

export function classifyBatchHealth(input: {
  status?: string;
  marginBps?: number;
  roiBps?: number;
  availableUnits?: number;
}): BatchHealthLevel {
  if (!input.status || input.status === "PURCHASED" || input.status === "IN_TRANSIT") {
    return "pending";
  }
  const basis = typeof input.marginBps === "number" ? input.marginBps : input.roiBps ?? 0;
  if (basis < 0) return "loss";
  if (basis < MARGIN_BPS_LOW_THRESHOLD) return "low";
  if (basis < MARGIN_BPS_HIGH_THRESHOLD) return "medium";
  return "high";
}

export function batchHealthLabel(level: BatchHealthLevel): string {
  switch (level) {
    case "pending":
      return "Pendiente";
    case "loss":
      return "Lote en pérdida";
    case "low":
      return "Rentabilidad baja";
    case "medium":
      return "Rentabilidad media";
    case "high":
      return "Lote rentable";
  }
}

export function classifyStockHealth(availableUnits: number): StockHealthLevel {
  if (availableUnits <= 0) return "out";
  if (availableUnits <= 2) return "low";
  return "healthy";
}

export function stockHealthLabel(level: StockHealthLevel): string {
  switch (level) {
    case "out":
      return "Agotado";
    case "low":
      return "Stock bajo";
    case "healthy":
      return "Disponible";
  }
}

export function classifyRotation(
  daysSinceLastSale: number | null,
  thresholdDays: number,
): RotationLevel {
  if (daysSinceLastSale === null) return "never";
  if (daysSinceLastSale >= thresholdDays) return "stale";
  if (daysSinceLastSale >= Math.max(1, Math.round(thresholdDays / 2))) return "aging";
  return "fresh";
}

export function rotationLabel(level: RotationLevel): string {
  switch (level) {
    case "fresh":
      return "Con rotación";
    case "aging":
      return "Rotación lenta";
    case "stale":
      return "Sin rotación";
    case "never":
      return "Nunca vendido";
  }
}

export function classifyIncidentImpact(input: {
  status?: string;
  lostCents: number;
  recoveredCents: number;
}): IncidentImpactLevel {
  if (input.status === "CANCELLED") return "cancelled";
  if (input.lostCents > input.recoveredCents) {
    return input.lostCents > 0 ? "loss" : "neutral";
  }
  if (input.recoveredCents > input.lostCents) return "recovered";
  if (input.lostCents > 0 || input.recoveredCents > 0) return "warning";
  return "neutral";
}

export function incidentImpactLabel(level: IncidentImpactLevel): string {
  switch (level) {
    case "cancelled":
      return "Cancelada";
    case "neutral":
      return "Sin impacto";
    case "warning":
      return "En revisión";
    case "loss":
      return "Impacto negativo";
    case "recovered":
      return "Monto recuperado";
  }
}

export function isBelowMinimumPrice(input: {
  effectiveUnitPrice: number;
  minimumPrice: number;
}): boolean {
  return input.minimumPrice > 0 && input.effectiveUnitPrice < input.minimumPrice;
}
