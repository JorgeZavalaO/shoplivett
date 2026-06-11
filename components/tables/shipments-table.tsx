"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { ShipmentStatusBadge } from "@/components/dashboard/shipment-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SHIPPING_METHOD_LABELS } from "@/lib/settings-defaults";

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
    cell: ({ row }) =>
      new Intl.DateTimeFormat("es-PE", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(row.original.createdAt)),
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
          : "—",
  },
  {
    header: "Estado",
    cell: ({ row }) => <ShipmentStatusBadge status={row.original.status} />,
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        render={<Link href={`/envios/${row.original.id}`}>Ver</Link>}
      />
    ),
  },
];

export function ShipmentsTable({ items, total, page, perPage, status, query }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
    state: { pagination: { pageIndex: page - 1, pageSize: perPage } },
  });

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const prevPage = page > 1 ? page - 1 : null;
  const nextPage = page < totalPages ? page + 1 : null;

  function buildHref(nextPageValue: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (query) params.set("q", query);
    if (status !== "ALL") params.set("status", status);
    if (nextPageValue > 1) params.set("page", String(nextPageValue));
    else params.delete("page");
    return `${pathname}?${params.toString()}`;
  }

  function onSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const q = String(data.get("q") ?? "").trim();
    const params = new URLSearchParams(searchParams.toString());
    if (q) params.set("q", q);
    else params.delete("q");
    params.delete("page");
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <form onSubmit={onSearchSubmit} className="flex flex-1 items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={query}
              placeholder="Buscar por clienta, agencia o tracking…"
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary">Buscar</Button>
        </form>
        <select
          value={status}
          onChange={(e) => {
            const params = new URLSearchParams(searchParams.toString());
            const v = e.target.value;
            if (v !== "ALL") params.set("status", v);
            else params.delete("status");
            params.delete("page");
            startTransition(() => router.replace(`${pathname}?${params.toString()}`));
          }}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm sm:w-52"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((g) => (
              <TableRow key={g.id}>
                {g.headers.map((h) => (
                  <TableHead key={h.id}>
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-sm text-muted-foreground">
                  {query ? `Sin resultados para "${query}".` : "Aún no hay envíos."}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((r) => (
                <TableRow key={r.id}>
                  {r.getVisibleCells().map((c) => (
                    <TableCell key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total === 0
            ? "Sin resultados"
            : `Mostrando ${(page - 1) * perPage + 1}–${Math.min(page * perPage, total)} de ${total}`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!prevPage}
            render={
              <Link
                href={prevPage ? buildHref(prevPage) : "#"}
                aria-disabled={!prevPage}
              >
                <ChevronLeft className="size-4" /> Anterior
              </Link>
            }
          />
          <span>Página {page} de {totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={!nextPage}
            render={
              <Link
                href={nextPage ? buildHref(nextPage) : "#"}
                aria-disabled={!nextPage}
              >
                Siguiente <ChevronRight className="size-4" />
              </Link>
            }
          />
        </div>
      </div>
    </div>
  );
}
