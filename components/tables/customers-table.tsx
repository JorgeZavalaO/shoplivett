"use client";

import Link from "next/link";
import {
  type ColumnDef,
} from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import {
  CustomerStatusBadge,
} from "@/components/dashboard/customer-status-badge";
import { formatWhatsAppDisplay } from "@/lib/phone";
import { WhatsAppQuickButton } from "@/components/whatsapp/whatsapp-actions";
import { PaginatedDataTable } from "./paginated-data-table";

export type CustomerRow = {
  id: string;
  name: string;
  whatsapp: string;
  status: "ACTIVE" | "FREQUENT" | "RISKY" | "BLOCKED";
  isActive: boolean;
  createdAt: Date;
};

type CustomersTableProps = {
  items: CustomerRow[];
  total: number;
  page: number;
  perPage: number;
  query: string;
};

const columns: ColumnDef<CustomerRow>[] = [
  {
    accessorKey: "name",
    header: "Nombre",
    cell: ({ row }) => (
      <Link
        href={`/clientes/${row.original.id}`}
        className="font-medium hover:underline"
      >
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: "whatsapp",
    header: "WhatsApp",
    cell: ({ row }) => (
      <span className="font-mono text-xs">
        {formatWhatsAppDisplay(row.original.whatsapp)}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Estado",
    cell: ({ row }) => <CustomerStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "createdAt",
    header: "Registrada",
    cell: ({ row }) =>
      new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(
        new Date(row.original.createdAt),
      ),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <div className="flex justify-end gap-2">
        <WhatsAppQuickButton
          customer={{
            name: row.original.name,
            whatsapp: row.original.whatsapp,
          }}
        />
        <Button
          variant="ghost"
          size="sm"
          render={<Link href={`/clientes/${row.original.id}`}>Ver</Link>}
        />
      </div>
    ),
  },
];

export function CustomersTable({
  items,
  total,
  page,
  perPage,
  query,
}: CustomersTableProps) {
  return (
    <PaginatedDataTable
      items={items}
      total={total}
      page={page}
      perPage={perPage}
      columns={columns}
      query={query}
      searchPlaceholder="Buscar por nombre o WhatsApp…"
      emptyMessage="Aún no hay clientas registradas."
      queryEmptyMessage={`No se encontraron clientas con "${query}".`}
    />
  );
}
