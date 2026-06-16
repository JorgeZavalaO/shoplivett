"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  type ColumnDef,
} from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaginatedDataTable } from "./paginated-data-table";

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
    cell: ({ row }) => row.original.category?.name ?? "\u2014",
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

function CategoryFilter({
  categoryId,
  categories,
}: {
  categoryId: string | null;
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function onChange(value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") params.set("category", value);
    else params.delete("category");
    params.delete("page");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <Select value={categoryId ?? "all"} onValueChange={onChange}>
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
  );
}

export function ProductsTable({
  items,
  total,
  page,
  perPage,
  query,
  categoryId,
  categories,
}: ProductsTableProps) {
  return (
    <PaginatedDataTable
      items={items}
      total={total}
      page={page}
      perPage={perPage}
      columns={columns}
      query={query}
      searchPlaceholder="Buscar por nombre o código de variante…"
      emptyMessage="Aún no hay productos registrados."
      queryEmptyMessage={`No se encontraron productos con "${query}".`}
      filters={
        <CategoryFilter categoryId={categoryId} categories={categories} />
      }
    />
  );
}
