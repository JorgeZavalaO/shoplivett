"use client";

import Link from "next/link";
import {
  type ColumnDef,
} from "@tanstack/react-table";

import { LiveStatusBadge } from "@/components/dashboard/live-status-badge";
import { Button } from "@/components/ui/button";
import { PaginatedDataTable } from "./paginated-data-table";

export type LiveRow = {
  id: string;
  name: string;
  channel: "TIKTOK" | "INSTAGRAM" | "FACEBOOK" | "WHATSAPP" | "OTHER";
  status: "OPEN" | "CLOSED" | "CANCELLED";
  startedAt: Date;
  closedAt: Date | null;
  responsible: { id: string; name: string | null; email: string | null } | null;
};

type Props = {
  items: LiveRow[];
  total: number;
  page: number;
  perPage: number;
  query: string;
  status: "ALL" | "OPEN" | "CLOSED" | "CANCELLED";
};

const CHANNEL_LABELS: Record<LiveRow["channel"], string> = {
  TIKTOK: "TikTok",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  WHATSAPP: "WhatsApp",
  OTHER: "Otro",
};

const LIVE_STATUS_OPTIONS = [
  { value: "ALL", label: "Todos" },
  { value: "OPEN", label: "Abiertos" },
  { value: "CLOSED", label: "Cerrados" },
  { value: "CANCELLED", label: "Cancelados" },
];

const columns: ColumnDef<LiveRow>[] = [
  {
    header: "Live",
    cell: ({ row }) => (
      <Link
        href={`/lives/${row.original.id}`}
        className="font-medium hover:underline"
      >
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: "channel",
    header: "Canal",
    cell: ({ row }) => CHANNEL_LABELS[row.original.channel],
  },
  {
    accessorKey: "responsible",
    header: "Responsable",
    cell: ({ row }) => row.original.responsible?.name ?? "Sin asignar",
  },
  {
    accessorKey: "status",
    header: "Estado",
    cell: ({ row }) => <LiveStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "startedAt",
    header: "Inicio",
    cell: ({ row }) =>
      new Intl.DateTimeFormat("es-PE", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(row.original.startedAt)),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        render={<Link href={`/lives/${row.original.id}`}>Ver</Link>}
      />
    ),
  },
];

export function LivesTable({
  items,
  total,
  page,
  perPage,
  query,
  status,
}: Props) {
  return (
    <PaginatedDataTable
      items={items}
      total={total}
      page={page}
      perPage={perPage}
      columns={columns}
      query={query}
      status={status}
      statusOptions={LIVE_STATUS_OPTIONS}
      searchPlaceholder="Buscar por nombre u observación…"
      emptyMessage="Aún no hay lives registrados."
      queryEmptyMessage={`No se encontraron lives con "${query}".`}
    />
  );
}
