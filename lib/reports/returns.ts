import { Prisma } from "@prisma/client";

import { centsToDecimalString, type Cents } from "@/lib/money";
import {
  INCIDENT_DECISION_LABELS,
  INCIDENT_TYPE_LABELS,
} from "@/lib/incidents-shared";
import { getPrisma } from "@/lib/prisma";
import {
  MAX_REPORT_ROWS,
  buildReportLimitMeta,
  resolveCents,
  safeRange,
  trimReportRows,
  type ReportDateRange,
  type ReportLimitMeta,
} from "@/lib/reports/shared/core";

export type ReturnsLossesRow = {
  incidentId: string;
  incidentDate: Date;
  type: string;
  typeLabel: string;
  status: string;
  decision: string;
  decisionLabel: string;
  orderNumber: string | null;
  variantCode: string | null;
  productName: string | null;
  customerName: string | null;
  quantity: number;
  restockQuantity: number;
  recoveredCents: Cents;
  recovered: string;
  lostCents: Cents;
  lost: string;
  description: string;
};

export type ReturnsLossesReport = {
  rows: ReturnsLossesRow[];
  totals: {
    lostCents: Cents;
    lost: string;
    recoveredCents: Cents;
    recovered: string;
    netCents: Cents;
    net: string;
  };
  range: ReportDateRange;
  type: string | "ALL";
  status: string | "ALL";
  decision: string | "ALL";
  meta: ReportLimitMeta;
};

export async function getReturnsLossesReport(
  range: ReportDateRange,
  options: {
    type?: string;
    status?: string;
    decision?: string;
  } = {},
): Promise<ReturnsLossesReport> {
  const prisma = getPrisma();
  const whereRange = safeRange(range);
  const where: Prisma.IncidentWhereInput = {
    ...(Object.keys(whereRange).length > 0 ? { incidentDate: whereRange } : {}),
    ...(options.type && options.type !== "ALL"
      ? { type: options.type as Prisma.IncidentWhereInput["type"] }
      : {}),
    ...(options.status && options.status !== "ALL"
      ? { status: options.status as Prisma.IncidentWhereInput["status"] }
      : {}),
    ...(options.decision && options.decision !== "ALL"
      ? { decision: options.decision as Prisma.IncidentWhereInput["decision"] }
      : {}),
  };

  const [totalRows, itemsRaw] = await Promise.all([
    prisma.incident.count({ where }),
    prisma.incident.findMany({
      where,
      orderBy: { incidentDate: "desc" },
      take: MAX_REPORT_ROWS + 1,
      select: {
        id: true,
        incidentDate: true,
        type: true,
        status: true,
        decision: true,
        quantity: true,
        restockQuantity: true,
        recoveredAmount: true,
        lostAmount: true,
        description: true,
        order: { select: { orderNumber: true } },
        variant: {
          select: {
            code: true,
            product: { select: { name: true } },
          },
        },
        customer: { select: { name: true } },
      },
    }),
  ]);
  const { rows: items, truncated } = trimReportRows(itemsRaw);

  const rows: ReturnsLossesRow[] = items.map((it) => {
    const recovered = resolveCents(it.recoveredAmount, true);
    const lost = resolveCents(it.lostAmount, true);
    return {
      incidentId: it.id,
      incidentDate: it.incidentDate,
      type: it.type,
      typeLabel: INCIDENT_TYPE_LABELS[it.type] ?? it.type,
      status: it.status,
      decision: it.decision,
      decisionLabel: INCIDENT_DECISION_LABELS[it.decision] ?? it.decision,
      orderNumber: it.order?.orderNumber ?? null,
      variantCode: it.variant?.code ?? null,
      productName: it.variant?.product?.name ?? null,
      customerName: it.customer?.name ?? null,
      quantity: it.quantity,
      restockQuantity: it.restockQuantity,
      recoveredCents: recovered,
      recovered: centsToDecimalString(recovered),
      lostCents: lost,
      lost: centsToDecimalString(lost),
      description: it.description,
    };
  });

  let lostCents = 0;
  let recoveredCents = 0;
  for (const r of rows) {
    if (r.status === "CANCELLED") continue;
    lostCents += r.lostCents;
    recoveredCents += r.recoveredCents;
  }

  return {
    rows,
    totals: {
      lostCents,
      lost: centsToDecimalString(lostCents),
      recoveredCents,
      recovered: centsToDecimalString(recoveredCents),
      netCents: recoveredCents - lostCents,
      net: centsToDecimalString(recoveredCents - lostCents),
    },
    range,
    type: (options.type as string) ?? "ALL",
    status: (options.status as string) ?? "ALL",
    decision: (options.decision as string) ?? "ALL",
    meta: buildReportLimitMeta(rows.length, truncated, totalRows),
  };
}
