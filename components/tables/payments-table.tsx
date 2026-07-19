"use client";

import Link from "next/link";
import {
  type ColumnDef,
} from "@tanstack/react-table";

import { PaymentStatusBadge } from "@/components/dashboard/payment-status-badge";
import { Button } from "@/components/ui/button";
import { PAYMENT_METHOD_LABELS } from "@/lib/settings-defaults";
import { WhatsAppQuickButton } from "@/components/whatsapp/whatsapp-actions";
import { PaginatedDataTable } from "./paginated-data-table";

const DATETIME_FORMAT = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "short",
  timeStyle: "short",
});

export type PaymentRow = {
  id: string;
  status: "PENDING" | "VALIDATED" | "REJECTED";
  method: "YAPE" | "PLIN" | "CASH" | "OTHER";
  amount: string;
  operationNumber: string | null;
  createdAt: Date;
  customer: { id: string; name: string; whatsapp: string };
  receiptCount: number;
  applicationCount: number;
};

type Props = {
  items: PaymentRow[];
  total: number;
  page: number;
  perPage: number;
  status: string;
  query: string;
};

const STATUS_OPTIONS = [
  { value: "ALL", label: "Todos" },
  { value: "PENDING", label: "Pendientes" },
  { value: "VALIDATED", label: "Validados" },
  { value: "REJECTED", label: "Rechazados" },
];

const columns: ColumnDef<PaymentRow>[] = [
  {
    header: "Fecha",
    cell: ({ row }) => DATETIME_FORMAT.format(new Date(row.original.createdAt)),
  },
  {
    header: "Clienta",
    cell: ({ row }) => (
      <Link href={`/clientes/${row.original.customer.id}`} className="hover:underline">
        {row.original.customer.name}
      </Link>
    ),
  },
  {
    header: "Método",
    cell: ({ row }) => PAYMENT_METHOD_LABELS[row.original.method],
  },
  {
    header: "Monto",
    cell: ({ row }) => `S/ ${row.original.amount}`,
  },
  {
    header: "N° op.",
    cell: ({ row }) => row.original.operationNumber || "\u2014",
  },
  {
    header: "Capturas",
    cell: ({ row }) => row.original.receiptCount,
  },
  {
    header: "Pedidos",
    cell: ({ row }) => row.original.applicationCount,
  },
  {
    header: "Estado",
    cell: ({ row }) => <PaymentStatusBadge status={row.original.status} />,
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
        <Button
          variant="ghost"
          size="sm"
          render={<Link href={`/pagos/${row.original.id}`}>Ver</Link>}
        />
      </div>
    ),
  },
];

export function PaymentsTable({ items, total, page, perPage, status, query }: Props) {
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
      searchPlaceholder="Buscar por clienta o N° de operación…"
      emptyMessage="Aún no hay pagos."
      queryEmptyMessage={`Sin resultados para "${query}".`}
    />
  );
}
