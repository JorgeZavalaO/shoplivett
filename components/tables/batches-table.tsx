"use client";

import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";

import { BatchStatusBadge } from "@/components/tables/batch-status-badge";
import { Button } from "@/components/ui/button";
import { BATCH_STATUS_OPTIONS } from "@/lib/import-batches-shared";
import { PaginatedDataTable } from "./paginated-data-table";

const DATE_FORMAT = new Intl.DateTimeFormat("es-PE", { dateStyle: "short" });

export type BatchRow = {
  id: string;
  code: string;
  purchaseDate: Date;
  shopper: string;
  agency: string;
  totalCostUsd: { toString(): string };
  totalInvestmentPen: { toString(): string };
  status: "PURCHASED" | "IN_TRANSIT" | "COMPLETE" | "CLOSED";
  createdAt: Date;
  createdBy: { id: string; name: string } | null;
  _count: { items: number };
};

type Props = {
  items: BatchRow[];
  total: number;
  page: number;
  perPage: number;
  query: string;
  status: string;
};

const columns: ColumnDef<BatchRow>[] = [
  {
    header: "Código",
    cell: ({ row }) => (
      <Link
        href={`/lotes/${row.original.id}`}
        className="font-mono text-sm font-medium hover:underline"
      >
        {row.original.code}
      </Link>
    ),
  },
  {
    accessorKey: "purchaseDate",
    header: "Fecha compra",
    cell: ({ row }) => DATE_FORMAT.format(new Date(row.original.purchaseDate)),
  },
  {
    accessorKey: "shopper",
    header: "Shopper",
    cell: ({ row }) => (
      <span className="text-sm">{row.original.shopper}</span>
    ),
  },
  {
    accessorKey: "agency",
    header: "Agencia",
  },
  {
    header: "Items",
    cell: ({ row }) => row.original._count.items,
  },
  {
    header: "Total invertido",
    cell: ({ row }) => {
      const val = row.original.totalInvestmentPen.toString();
      return `S/ ${Number(val).toFixed(2)}`;
    },
  },
  {
    accessorKey: "status",
    header: "Estado",
    cell: ({ row }) => <BatchStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "createdBy",
    header: "Creado por",
    cell: ({ row }) => row.original.createdBy?.name ?? "-",
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        render={<Link href={`/lotes/${row.original.id}`}>Ver</Link>}
      />
    ),
  },
];

export function BatchesTable({
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
      statusOptions={BATCH_STATUS_OPTIONS as unknown as Array<{ value: string; label: string }>}
      searchPlaceholder="Buscar por código, shopper o agencia…"
      emptyMessage="Aún no hay lotes registrados."
      queryEmptyMessage={`No se encontraron lotes con "${query}".`}
    />
  );
}
