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

import { Badge } from "@/components/ui/badge";
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
    cell: ({ row }) => row.original.color || "—",
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
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSearchSubmit} className="flex max-w-md items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={query}
            placeholder="Buscar por código, producto o color…"
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  {query
                    ? `No se encontraron variantes con “${query}”.`
                    : "Aún no hay variantes registradas."}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
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
            : `Mostrando ${(page - 1) * perPage + 1}–${Math.min(
                page * perPage,
                total,
              )} de ${total}`}
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
          <span>
            Página {page} de {totalPages}
          </span>
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
