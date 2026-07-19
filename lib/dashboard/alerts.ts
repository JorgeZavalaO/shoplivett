import { Prisma } from "@prisma/client";

import { toCents } from "@/lib/money";
import {
  getFinancialOverview,
  monthRange,
  type FinancialDashboardFilter,
  type FinancialOverview,
} from "@/lib/dashboard/overview";
import { getLowRotationProducts } from "@/lib/dashboard/low-rotation";
import { getPrisma } from "@/lib/prisma";

export type FinancialAlert = {
  level: "warning" | "destructive" | "info";
  title: string;
  description: string;
  href?: string;
};

export type FinancialAlerts = {
  alerts: FinancialAlert[];
  lowMarginCount: number;
  lowRotationCount: number;
  negativeProfit: boolean;
  targetMarginBps: number;
  minimumMarginBps: number;
};

export type FinancialAlertsPrecomputed = {
  overview?: FinancialOverview;
  lowRotationCount?: number;
  lowRotationThresholdDays?: number;
};

export async function getFinancialAlerts(
  filter: FinancialDashboardFilter = {},
  precomputed: FinancialAlertsPrecomputed = {},
): Promise<FinancialAlerts> {
  const prisma = getPrisma();
  const settings = await prisma.businessSettings.findUnique({
    where: { id: "default" },
    select: {
      minimumTargetMarginBps: true,
      objectiveTargetMarginBps: true,
    },
  });
  const minimumMarginBps = settings?.minimumTargetMarginBps ?? 1500;
  const targetMarginBps = settings?.objectiveTargetMarginBps ?? 3000;

  const overview = precomputed.overview ?? (await getFinancialOverview(filter));
  const lowRotation =
    precomputed.lowRotationCount !== undefined
      ? {
          rows: new Array(precomputed.lowRotationCount).fill(null),
          thresholdDays: precomputed.lowRotationThresholdDays ?? 60,
        }
      : await getLowRotationProducts(60, 1000);

  const lowMarginRange = monthRange(
    filter.year ?? overview.year,
    filter.month ?? overview.month,
  );
  const lowMarginWhere: Prisma.OrderItemWhereInput = {
    order: {
      status: "PAID",
      profitCalculatedAt: { gte: lowMarginRange.gte, lte: lowMarginRange.lte },
    },
    costSource: { in: ["BATCH", "LEGACY"] },
  };
  // Acotado por el rango del mes, y además está limitado por el número
  // de variantes vendidas en ese periodo.
  const lowMarginCandidates = await prisma.orderItem.groupBy({
    by: ["variantId"],
    where: lowMarginWhere,
    _sum: { lineTotal: true, grossProfitPen: true },
  });
  let lowMarginCount = 0;
  for (const g of lowMarginCandidates) {
    const revenue = toCents(g._sum.lineTotal);
    if (revenue <= 0) continue;
    const profit = toCents(g._sum.grossProfitPen, { allowNegative: true });
    const bps = Math.round((profit * 10000) / revenue);
    if (bps < minimumMarginBps) lowMarginCount += 1;
  }

  const alerts: FinancialAlert[] = [];
  if (overview.marginBps < minimumMarginBps) {
    alerts.push({
      level: overview.marginBps < 0 ? "destructive" : "warning",
      title: "Margen por debajo del objetivo",
      description: `El margen real del mes es ${(overview.marginBps / 100).toFixed(1)}% (objetivo: ${(targetMarginBps / 100).toFixed(0)}%).`,
      href: "/reportes?section=summary",
    });
  }
  if (overview.realNetProfitCents < 0) {
    alerts.push({
      level: "destructive",
      title: "Utilidad neta real negativa",
      description: `Este mes se esta perdiendo S/ ${Math.abs(Number(overview.realNetProfit)).toFixed(2)} despues de gastos y perdidas.`,
      href: "/gastos",
    });
  }
  if (lowMarginCount > 0) {
    alerts.push({
      level: "warning",
      title: `${lowMarginCount} producto(s) con margen bajo`,
      description: `Hay variantes con margen bruto por debajo del ${(minimumMarginBps / 100).toFixed(0)}% en el mes.`,
      href: "/reportes?section=top",
    });
  }
  if (lowRotation.rows.length > 0) {
    alerts.push({
      level: "info",
      title: `${lowRotation.rows.length} producto(s) sin rotacion`,
      description: `Variantes con stock sin ventas en los ultimos ${lowRotation.thresholdDays} dias.`,
      href: "/inventario",
    });
  }

  return {
    alerts,
    lowMarginCount,
    lowRotationCount: lowRotation.rows.length,
    negativeProfit: overview.realNetProfitCents < 0,
    targetMarginBps,
    minimumMarginBps,
  };
}
