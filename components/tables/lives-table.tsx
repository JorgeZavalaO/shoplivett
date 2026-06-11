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

import { LiveStatusBadge } from "@/components/dashboard/live-status-badge";
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

export type LiveRow = {
  id: string;
  name: string;
  channel: "TIKTOK" | "INSTAGRAM" | "FACEBOOK" | "WHATSAPP" | "OTHER";
  status: "OPEN" | "CLOSED" | "CANCELLED";
  startedAt: Date;
  closedAt: Date | null;
  responsible: { id: string; name: string | null; email: string | null } | null;
};

type Props = {
  items: LiveRow[];
  total: number;
  page: number;
  perPage: number;
  query: string;
  status: "ALL" | "OPEN" | "CLOSED" | "CANCELLED";
};

const CHANNEL_LABELS: Record<LiveRow["channel"], string> = {
  TIKTOK: "TikTok",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  WHATSAPP: "WhatsApp",
  OTHER: "Otro",
};

const LIVE_STATUS_OPTIONS = [
  { value: "ALL", label: "Todos" },
  { value: "OPEN", label: "Abiertos" },
  { value: "CLOSED", label: "Cerrados" },
  { value: "CANCELLED", label: "Cancelados" },
] as const;

const columns: ColumnDef<LiveRow>[] = [
  {
    header: "Live",
    cell: ({ row }) => (
      <Link
        href={`/lives/${row.original.id}`}
        className="font-medium hover:underline"
      >
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: "channel",
    header: "Canal",
    cell: ({ row }) => CHANNEL_LABELS[row.original.channel],
  },
  {
    accessorKey: "responsible",
    header: "Responsable",
    cell: ({ row }) => row.original.responsible?.name ?? "Sin asignar",
  },
  {
    accessorKey: "status",
    header: "Estado",
    cell: ({ row }) => <LiveStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "startedAt",
    header: "Inicio",
    cell: ({ row }) =>
      new Intl.DateTimeFormat("es-PE", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(row.original.startedAt)),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        render={<Link href={`/lives/${row.original.id}`}>Ver</Link>}
      />
    ),
  },
];

export function LivesTable({
  items,
  total,
  page,
  perPage,
  query,
  status,
}: Props) {
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
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  function onStatusChange(nextStatus: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextStatus && nextStatus !== "ALL") params.set("status", nextStatus);
    else params.delete("status");
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
              placeholder="Buscar por nombre u observación…"
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
        </form>
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-52"
        >
          {LIVE_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
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
                    ? `No se encontraron lives con “${query}”.`
                    : "Aún no hay lives registrados."}
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
