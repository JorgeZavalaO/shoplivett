import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import type {
  IncidentReturnDecision,
  IncidentStatus,
  IncidentType,
} from "@prisma/client";

import { Button } from "@/components/ui/button";
import { IncidentsTable } from "@/components/tables/incidents-table";
import { requirePermission } from "@/lib/authorization";
import { listIncidentsAction } from "@/actions/incidents";
import {
  INCIDENT_DECISION_OPTIONS,
  INCIDENT_STATUS_OPTIONS,
  INCIDENT_TYPE_OPTIONS,
} from "@/lib/incidents-shared";

export const metadata: Metadata = { title: "Incidencias" };

const VALID_TYPES = new Set<string>(INCIDENT_TYPE_OPTIONS.map((o) => o.value));
const VALID_STATUS = new Set<string>(INCIDENT_STATUS_OPTIONS.map((o) => o.value));
const VALID_DECISIONS = new Set<string>(
  INCIDENT_DECISION_OPTIONS.map((o) => o.value),
);

type SearchParams = Promise<{
  q?: string | string[];
  page?: string | string[];
  type?: string | string[];
  status?: string | string[];
  decision?: string | string[];
  year?: string | string[];
  month?: string | string[];
}>;

function first<T = string>(v: T | T[] | undefined): T | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function IncidenciasPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePermission("incidents.read");
  const sp = await searchParams;

  const q = first(sp.q) ?? "";
  const page = Math.max(1, Number(first(sp.page)) || 1);

  const typeRaw = first(sp.type) ?? "ALL";
  const type: IncidentType | "ALL" = VALID_TYPES.has(typeRaw)
    ? (typeRaw as IncidentType)
    : "ALL";

  const statusRaw = first(sp.status) ?? "ALL";
  const status: IncidentStatus | "ALL" = VALID_STATUS.has(statusRaw)
    ? (statusRaw as IncidentStatus)
    : "ALL";

  const decisionRaw = first(sp.decision) ?? "ALL";
  const decision: IncidentReturnDecision | "ALL" = VALID_DECISIONS.has(decisionRaw)
    ? (decisionRaw as IncidentReturnDecision)
    : "ALL";

  const yearRaw = Number(first(sp.year));
  const monthRaw = Number(first(sp.month));
  const year = Number.isFinite(yearRaw) && yearRaw > 1970 ? yearRaw : undefined;
  const month =
    Number.isFinite(monthRaw) && monthRaw >= 1 && monthRaw <= 12
      ? monthRaw
      : undefined;

  const result = await listIncidentsAction({
    query: q,
    type,
    status,
    decision,
    year,
    month,
    page,
    perPage: 20,
  });

  const rows = result.items.map((it) => ({
    id: it.id,
    incidentDate: it.incidentDate,
    type: it.type,
    status: it.status,
    decision: it.decision,
    quantity: it.quantity,
    description: it.description,
    lostAmount: { toString: () => it.lostAmount.toString() },
    recoveredAmount: { toString: () => it.recoveredAmount.toString() },
    order: it.order,
    variant: it.variant,
    customer: it.customer,
  }));

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Incidencias</h1>
          <p className="text-sm text-muted-foreground">
            Devoluciones, danos, perdidas, reclamos y cambios. Integradas con
            stock, creditos y movimientos.
          </p>
        </div>
        <Button
          render={
            <Link href="/incidencias/nuevo">
              <Plus className="size-4" /> Nueva incidencia
            </Link>
          }
        />
      </div>

      <FilterBar
        query={q}
        type={result.type}
        status={result.status}
        decision={result.decision}
        month={result.month}
      />

      <IncidentsTable
        items={rows}
        total={result.total}
        page={result.page}
        perPage={result.perPage}
        query={result.query}
        type={result.type}
        status={result.status}
        decision={result.decision}
        month={result.month}
        totals={result.totals}
      />
    </div>
  );
}

function FilterBar({
  query,
  type,
  status,
  decision,
  month,
}: {
  query: string;
  type: IncidentType | "ALL";
  status: IncidentStatus | "ALL";
  decision: IncidentReturnDecision | "ALL";
  month: { year: number; month: number } | null;
}) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (type !== "ALL") params.set("type", type);
  if (status !== "ALL") params.set("status", status);
  if (decision !== "ALL") params.set("decision", decision);
  if (month) {
    params.set("year", String(month.year));
    params.set("month", String(month.month));
  }
  const qs = params.toString();
  const base = qs ? `/incidencias?${qs}` : "/incidencias";

  return (
    <form
      method="GET"
      action="/incidencias"
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 md:flex-row md:flex-wrap md:items-end"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="q" className="text-xs text-muted-foreground">
          Buscar
        </label>
        <input
          id="q"
          name="q"
          defaultValue={query}
          placeholder="Detalle, pedido, clienta o SKU"
          className="h-8 w-56 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="type" className="text-xs text-muted-foreground">
          Tipo
        </label>
        <select
          id="type"
          name="type"
          defaultValue={type}
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="ALL">Todos</option>
          {INCIDENT_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="status" className="text-xs text-muted-foreground">
          Estado
        </label>
        <select
          id="status"
          name="status"
          defaultValue={status}
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="ALL">Todos</option>
          {INCIDENT_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="decision" className="text-xs text-muted-foreground">
          Decision
        </label>
        <select
          id="decision"
          name="decision"
          defaultValue={decision}
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="ALL">Todas</option>
          {INCIDENT_DECISION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="month" className="text-xs text-muted-foreground">
          Mes
        </label>
        <input
          id="month"
          name="month"
          type="month"
          defaultValue={
            month
              ? `${month.year}-${String(month.month).padStart(2, "0")}`
              : ""
          }
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <div className="flex items-end gap-2">
        <button
          type="submit"
          className="h-8 rounded-md border border-transparent bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80"
        >
          Filtrar
        </button>
        <a
          href={base}
          className="h-8 rounded-md border border-border bg-background px-3 text-sm hover:bg-muted inline-flex items-center"
        >
          Limpiar
        </a>
      </div>
    </form>
  );
}
