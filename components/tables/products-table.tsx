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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  category: { id: string; name: string; slug: string } | null;
  variantCount: number;
};

type ProductsTableProps = {
  items: ProductRow[];
  total: number;
  page: number;
  perPage: number;
  query: string;
  categoryId: string | null;
  categories: { id: string; name: string }[];
};

const columns: ColumnDef<ProductRow>[] = [
  {
    accessorKey: "name",
    header: "Producto",
    cell: ({ row }) => (
      <Link
        href={`/productos/${row.original.id}`}
        className="font-medium hover:underline"
      >
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: "category",
    header: "Categoría",
    cell: ({ row }) => row.original.category?.name ?? "—",
  },
  {
    accessorKey: "variantCount",
    header: "Variantes",
    cell: ({ row }) => (
      <Badge variant="secondary">{row.original.variantCount}</Badge>
    ),
  },
  {
    accessorKey: "isActive",
    header: "Estado",
    cell: ({ row }) =>
      row.original.isActive ? (
        <Badge className="bg-emerald-600 text-white">Activo</Badge>
      ) : (
        <Badge variant="outline" className="bg-amber-500 text-white">
          Inactivo
        </Badge>
      ),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          render={
            <Link href={`/productos/${row.original.id}`}>Ver</Link>
          }
        />
      </div>
    ),
  },
];

export function ProductsTable({
  items,
  total,
  page,
  perPage,
  query,
  categoryId,
  categories,
}: ProductsTableProps) {
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
    if (categoryId) params.set("category", categoryId);
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

  function onCategoryChange(value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") params.set("category", value);
    else params.delete("category");
    params.delete("page");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
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
              placeholder="Buscar por nombre o código de variante…"
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
        </form>
        <Select
          value={categoryId ?? "all"}
          onValueChange={onCategoryChange}
        >
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Todas las categorías" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
                    ? `No se encontraron productos con “${query}”.`
                    : "Aún no hay productos registrados."}
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
