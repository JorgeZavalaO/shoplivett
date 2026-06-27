// Constantes y tipos cliente-seguros para el dashboard financiero (Sprint 24).
// NO importar nada de Prisma aquí; este archivo se usa en componentes client.

export const LOW_ROTATION_THRESHOLD_DAYS = 60;
export const DEFAULT_TOP_PRODUCTS_LIMIT = 5;
export const DEFAULT_LOW_ROTATION_LIMIT = 10;
export const DEFAULT_BATCH_PROFITABILITY_LIMIT = 10;

export const MARGIN_BPS_LOW_THRESHOLD = 1500; // 15%
export const MARGIN_BPS_HIGH_THRESHOLD = 3000; // 30%

export const ALERT_LEVEL_LABELS: Record<"warning" | "destructive" | "info", string> = {
  warning: "Atencion",
  destructive: "Critico",
  info: "Sugerencia",
};
