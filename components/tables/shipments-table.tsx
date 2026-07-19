"use client";

import Link from "next/link";
import {
  type ColumnDef,
} from "@tanstack/react-table";

import { ShipmentStatusBadge } from "@/components/dashboard/shipment-status-badge";
import { Button } from "@/components/ui/button";
import { SHIPPING_METHOD_LABELS } from "@/lib/settings-defaults";
import { WhatsAppQuickButton } from "@/components/whatsapp/whatsapp-actions";
import { PaginatedDataTable } from "./paginated-data-table";

const DATETIME_FORMAT = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "short",
  timeStyle: "short",
});

export type ShipmentRow = {
  id: string;
  status: "PENDING" | "PREPARING" | "READY" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  shippingMethod: "DELIVERY_PROPIO" | "OLVA" | "SHALOM" | "MOTORIZADO" | "RECOJO";
  shippingCost: string;
  isFreeShipping: boolean;
  agencyName: string | null;
  trackingCode: string | null;
  createdAt: Date;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  customer: { id: string; name: string; whatsapp: string };
  orderCount: number;
};

type Props = {
  items: ShipmentRow[];
  total: number;
  page: number;
  perPage: number;
  status: string;
  query: string;
};

const STATUS_OPTIONS = [
  { value: "ALL", label: "Todos" },
  { value: "PENDING", label: "Pendiente" },
  { value: "PREPARING", label: "Preparando" },
  { value: "READY", label: "Listo" },
  { value: "SHIPPED", label: "Enviado" },
  { value: "DELIVERED", label: "Entregado" },
  { value: "CANCELLED", label: "Cancelado" },
];

const columns: ColumnDef<ShipmentRow>[] = [
  {
    header: "Creado",
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
    header: "Pedidos",
    cell: ({ row }) => row.original.orderCount,
  },
  {
    header: "Método",
    cell: ({ row }) => SHIPPING_METHOD_LABELS[row.original.shippingMethod],
  },
  {
    header: "Costo",
    cell: ({ row }) =>
      row.original.isFreeShipping ? (
        <span className="text-emerald-600">Gratis</span>
      ) : (
        `S/ ${row.original.shippingCost}`
      ),
  },
  {
    header: "Tracking",
    cell: ({ row }) =>
      row.original.trackingCode
        ? row.original.trackingCode
        : row.original.agencyName
          ? row.original.agencyName
          : "\u2014",
  },
  {
    header: "Estado",
    cell: ({ row }) => <ShipmentStatusBadge status={row.original.status} />,
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
          render={<Link href={`/envios/${row.original.id}`}>Ver</Link>}
        />
      </div>
    ),
  },
];

export function ShipmentsTable({ items, total, page, perPage, status, query }: Props) {
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
      searchPlaceholder="Buscar por clienta, agencia o tracking…"
      emptyMessage="Aún no hay envíos."
      queryEmptyMessage={`Sin resultados para "${query}".`}
    />
  );
}
