"use client";

import Link from "next/link";
import {
  type ColumnDef,
} from "@tanstack/react-table";

import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { OrderExpiryBadge } from "@/components/dashboard/order-expiry-badge";
import { Button } from "@/components/ui/button";
import { WhatsAppQuickButton } from "@/components/whatsapp/whatsapp-actions";
import { PaginatedDataTable } from "./paginated-data-table";

export type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  total: string;
  balance: string;
  expiresAt: Date;
  createdAt: Date;
  customer: { id: string; name: string; whatsapp: string };
  liveSession: { id: string; name: string } | null;
  variantCount: number;
};

type Props = {
  items: OrderRow[];
  total: number;
  page: number;
  perPage: number;
  status: string;
  query: string;
};

const STATUS_OPTIONS = [
  { value: "ALL", label: "Todos" },
  { value: "PAYMENT_VALIDATION_PENDING", label: "Validación pendiente" },
  { value: "RESERVED", label: "Reservadas" },
  { value: "PARTIALLY_PAID", label: "Saldo pendiente" },
  { value: "PAID", label: "Pagadas" },
  { value: "CANCELLED", label: "Canceladas" },
  { value: "EXPIRED", label: "Vencidas" },
];

const columns: ColumnDef<OrderRow>[] = [
  {
    header: "Número",
    cell: ({ row }) => (
      <Link href={`/pedidos/${row.original.id}`} className="font-mono text-xs font-medium hover:underline">
        {row.original.orderNumber}
      </Link>
    ),
  },
  {
    accessorKey: "customer",
    header: "Clienta",
    cell: ({ row }) => row.original.customer.name,
  },
  {
    accessorKey: "liveSession",
    header: "Live",
    cell: ({ row }) => row.original.liveSession?.name || "\u2014",
  },
  {
    accessorKey: "status",
    header: "Estado",
    cell: ({ row }) => <OrderStatusBadge status={row.original.status as Parameters<typeof OrderStatusBadge>[0]["status"]} />,
  },
  {
    accessorKey: "total",
    header: "Total",
    cell: ({ row }) => `S/ ${row.original.total}`,
  },
  {
    accessorKey: "balance",
    header: "Saldo",
    cell: ({ row }) => `S/ ${row.original.balance}`,
  },
  {
    accessorKey: "expiresAt",
    header: "Vence",
    cell: ({ row }) => (
      <div className="flex flex-col gap-1">
        <span>
          {new Intl.DateTimeFormat("es-PE", { dateStyle: "short" }).format(
            new Date(row.original.expiresAt),
          )}
        </span>
        <OrderExpiryBadge
          expiresAt={row.original.expiresAt}
          status={row.original.status}
        />
      </div>
    ),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <div className="flex justify-end gap-2">
        <WhatsAppQuickButton
          customer={{
            name: row.original.customer.name,
            whatsapp: row.original.customer.whatsapp,
          }}
        />
        <Button variant="ghost" size="sm" render={<Link href={`/pedidos/${row.original.id}`}>Ver</Link>} />
      </div>
    ),
  },
];

export function OrdersTable({ items, total, page, perPage, status, query }: Props) {
  return (
    <PaginatedDataTable
      items={items}
      total={total}
      page={page}
      perPage={perPage}
      columns={columns}
      query={query}
      status={status}
      statusOptions={STATUS_OPTIONS}
      searchPlaceholder="Buscar por número o clienta…"
      emptyMessage="Aún no hay pedidos."
      queryEmptyMessage={`Sin resultados para "${query}".`}
    />
  );
}
