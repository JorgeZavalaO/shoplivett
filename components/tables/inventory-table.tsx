"use client";

import Link from "next/link";
import {
  type ColumnDef,
} from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaginatedDataTable } from "./paginated-data-table";

export type InventoryRow = {
  id: string;
  code: string;
  color: string | null;
  size: string | null;
  stock: number;
  reservedStock: number;
  soldStock: number;
  available: number;
  status: "ACTIVE" | "HIDDEN" | "ARCHIVED";
  product: {
    id: string;
    name: string;
    isActive: boolean;
    category: { id: string; name: string };
  };
};

type Props = {
  items: InventoryRow[];
  total: number;
  page: number;
  perPage: number;
  query: string;
};

const columns: ColumnDef<InventoryRow>[] = [
  {
    header: "Producto",
    cell: ({ row }) => (
      <Link
        href={`/inventario/${row.original.id}`}
        className="font-medium hover:underline"
      >
        {row.original.product.name}
      </Link>
    ),
  },
  {
    accessorKey: "code",
    header: "Código",
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.code}</span>
    ),
  },
  {
    accessorKey: "color",
    header: "Variante",
    cell: ({ row }) => row.original.color || "\u2014",
  },
  {
    accessorKey: "stock",
    header: "Stock",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.stock}</span>
    ),
  },
  {
    accessorKey: "reservedStock",
    header: "Reservado",
    cell: ({ row }) => (
      <Badge
        variant={row.original.reservedStock > 0 ? "secondary" : "outline"}
        className={row.original.reservedStock > 0 ? "bg-amber-500 text-white" : ""}
      >
        {row.original.reservedStock}
      </Badge>
    ),
  },
  {
    accessorKey: "soldStock",
    header: "Vendido",
    cell: ({ row }) => (
      <Badge
        variant={row.original.soldStock > 0 ? "default" : "outline"}
        className={row.original.soldStock > 0 ? "bg-blue-600 text-white" : ""}
      >
        {row.original.soldStock}
      </Badge>
    ),
  },
  {
    accessorKey: "available",
    header: "Disponible",
    cell: ({ row }) => {
      const a = row.original.available;
      return (
        <Badge variant={a > 0 ? "default" : "destructive"}>{a}</Badge>
      );
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        render={
          <Link href={`/inventario/${row.original.id}`}>Detalle</Link>
        }
      />
    ),
  },
];

export function InventoryTable({ items, total, page, perPage, query }: Props) {
  return (
    <PaginatedDataTable
      items={items}
      total={total}
      page={page}
      perPage={perPage}
      columns={columns}
      query={query}
      searchPlaceholder="Buscar por código, producto o color…"
      emptyMessage="Aún no hay variantes registradas."
      queryEmptyMessage={`No se encontraron variantes con "${query}".`}
    />
  );
}
