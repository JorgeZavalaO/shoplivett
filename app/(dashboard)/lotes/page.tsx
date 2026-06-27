import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { type ImportBatchStatus } from "@prisma/client";

import { listBatchesAction } from "@/actions/import-batches";
import { BatchesTable } from "@/components/tables/batches-table";
import { requireRole } from "@/lib/permissions";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Lotes de importación" };

type SearchParams = Promise<{
  q?: string | string[];
  page?: string | string[];
  status?: string | string[];
}>;

export default async function LotesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["ADMIN", "SELLER"]);
  const sp = await searchParams;
  const q = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const pageRaw = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const statusRaw = Array.isArray(sp.status) ? sp.status[0] : sp.status;
  const page = pageRaw ? Math.max(1, Number(pageRaw)) || 1 : 1;
  const validStatuses: ImportBatchStatus[] = [
    "PURCHASED", "IN_TRANSIT", "COMPLETE", "CLOSED",
  ];
  const status =
    statusRaw && validStatuses.includes(statusRaw as ImportBatchStatus)
      ? statusRaw
      : "ALL";

  const result = await listBatchesAction({
    query: q ?? "",
    status: status as ImportBatchStatus | "ALL",
    page,
    perPage: 20,
  });

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lotes de importación</h1>
          <p className="text-sm text-muted-foreground">
            Registra compras, importaciones y asocia productos a cada lote.
          </p>
        </div>
        <Button
          render={
            <Link href="/lotes/nuevo">
              <Plus className="size-4" /> Nuevo lote
            </Link>
          }
        />
      </div>

      <BatchesTable
        items={result.items as unknown as import("@/components/tables/batches-table").BatchRow[]}
        total={result.total}
        page={result.page}
        perPage={result.perPage}
        query={result.query}
        status={result.status}
      />
    </div>
  );
}
