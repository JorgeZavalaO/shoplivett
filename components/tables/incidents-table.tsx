"use client";

import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { IncidentStatusBadge } from "@/components/tables/incident-status-badge";
import { IncidentTypeBadge } from "@/components/tables/incident-type-badge";
import { PaginatedDataTable } from "@/components/tables/paginated-data-table";
import {
  INCIDENT_DECISION_LABELS,
  INCIDENT_TYPE_LABELS,
} from "@/lib/incidents-shared";
import type {
  IncidentReturnDecision,
  IncidentStatus,
  IncidentType,
} from "@prisma/client";

export type IncidentRow = {
  id: string;
  incidentDate: Date;
  type: IncidentType;
  status: IncidentStatus;
  decision: IncidentReturnDecision;
  quantity: number;
  description: string;
  lostAmount: { toString(): string };
  recoveredAmount: { toString(): string };
  order: { id: string; orderNumber: string } | null;
  variant: {
    id: string;
    code: string;
    color: string | null;
    product: { id: string; name: string };
  } | null;
  customer: { id: string; name: string; whatsapp: string } | null;
};

type Props = {
  items: IncidentRow[];
  total: number;
  page: number;
  perPage: number;
  query: string;
  type: IncidentType | "ALL";
  status: IncidentStatus | "ALL";
  decision: IncidentReturnDecision | "ALL";
  month: { year: number; month: number } | null;
  totals: { lost: string; recovered: string };
};

const columns: ColumnDef<IncidentRow>[] = [
  {
    header: "Fecha",
    cell: ({ row }) =>
      new Intl.DateTimeFormat("es-PE", { dateStyle: "short" }).format(
        new Date(row.original.incidentDate),
      ),
  },
  {
    accessorKey: "type",
    header: "Tipo",
    cell: ({ row }) => <IncidentTypeBadge type={row.original.type} />,
  },
  {
    header: "Detalle",
    cell: ({ row }) => (
      <Link
        href={`/incidencias/${row.original.id}`}
        className="font-medium hover:underline"
      >
        {row.original.description}
      </Link>
    ),
  },
  {
    header: "Pedido",
    cell: ({ row }) =>
      row.original.order ? (
        <Link
          href={`/pedidos/${row.original.order.id}`}
          className="text-xs font-mono hover:underline"
        >
          {row.original.order.orderNumber}
        </Link>
      ) : (
        <span className="text-xs text-muted-foreground">-</span>
      ),
  },
  {
    header: "Producto",
    cell: ({ row }) =>
      row.original.variant ? (
        <span className="text-xs">
          {row.original.variant.product.name}
          {row.original.variant.color ? (
            <span className="text-muted-foreground">
              {" "}
              ({row.original.variant.color})
            </span>
          ) : null}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">-</span>
      ),
  },
  {
    header: "Cant.",
    cell: ({ row }) => row.original.quantity,
  },
  {
    header: "Decision",
    cell: ({ row }) => (
      <span className="text-xs">
        {INCIDENT_DECISION_LABELS[row.original.decision]}
      </span>
    ),
  },
  {
    header: "Perdido",
    cell: ({ row }) => {
      const cents = Number(row.original.lostAmount.toString());
      if (cents === 0) {
        return <span className="text-xs text-muted-foreground">-</span>;
      }
      return (
        <span className="font-mono text-xs text-destructive">
          S/ {cents.toFixed(2)}
        </span>
      );
    },
  },
  {
    header: "Recuperado",
    cell: ({ row }) => {
      const cents = Number(row.original.recoveredAmount.toString());
      if (cents === 0) {
        return <span className="text-xs text-muted-foreground">-</span>;
      }
      return (
        <span className="font-mono text-xs text-emerald-600">
          S/ {cents.toFixed(2)}
        </span>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Estado",
    cell: ({ row }) => <IncidentStatusBadge status={row.original.status} />,
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        render={<Link href={`/incidencias/${row.original.id}`}>Ver</Link>}
      />
    ),
  },
];

export function IncidentsTable({
  items,
  total,
  page,
  perPage,
  query,
  type,
  status,
  decision,
  month,
  totals,
}: Props) {
  return (
    <div className="flex flex-col gap-4">
      <PaginatedDataTable
        items={items}
        total={total}
        page={page}
        perPage={perPage}
        columns={columns}
        searchPlaceholder="Buscar por detalle, pedido, clienta o SKU…"
        query={query}
        emptyMessage="Aun no hay incidencias registradas."
        queryEmptyMessage={`No se encontraron incidencias con "${query}".`}
      />

      <div className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-3">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            Filtros aplicados
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <FilterChip
              label={`Tipo: ${type === "ALL" ? "Todos" : INCIDENT_TYPE_LABELS[type]}`}
            />
            <FilterChip
              label={`Estado: ${status === "ALL" ? "Todos" : status}`}
            />
            <FilterChip
              label={`Decision: ${decision === "ALL" ? "Todas" : INCIDENT_DECISION_LABELS[decision]}`}
            />
            {month ? (
              <FilterChip
                label={`Periodo: ${String(month.month).padStart(2, "0")}/${month.year}`}
              />
            ) : (
              <FilterChip label="Periodo: Todos" />
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <p className="text-xs text-muted-foreground">Total perdido (pagina)</p>
          <p className="text-2xl font-semibold font-mono text-destructive">
            S/ {totals.lost}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <p className="text-xs text-muted-foreground">Total recuperado (pagina)</p>
          <p className="text-2xl font-semibold font-mono text-emerald-600">
            S/ {totals.recovered}
          </p>
        </div>
      </div>
    </div>
  );
}

function FilterChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-xs">
      {label}
    </span>
  );
}
