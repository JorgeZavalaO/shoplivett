import Link from "next/link";
import { Plus } from "lucide-react";

import { getLiveSessionsAction } from "@/actions/lives";
import { LivesTable } from "@/components/tables/lives-table";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string | string[];
  page?: string | string[];
  status?: string | string[];
}>;

export default async function LivesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const q = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const pageRaw = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const statusRaw = Array.isArray(sp.status) ? sp.status[0] : sp.status;
  const page = pageRaw ? Math.max(1, Number(pageRaw)) || 1 : 1;
  const status =
    statusRaw === "OPEN" || statusRaw === "CLOSED" || statusRaw === "CANCELLED"
      ? statusRaw
      : "ALL";

  const result = await getLiveSessionsAction({
    query: q ?? "",
    status,
    page,
    perPage: 20,
  });

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lives</h1>
          <p className="text-sm text-muted-foreground">
            Crea, abre, cierra y consulta sesiones de live para agrupar ventas.
          </p>
        </div>
        <Button
          render={
            <Link href="/lives/nuevo">
              <Plus className="size-4" /> Nuevo live
            </Link>
          }
        />
      </div>

      <LivesTable
        items={result.items}
        total={result.total}
        page={result.page}
        perPage={result.perPage}
        query={result.query}
        status={result.status}
      />
    </div>
  );
}
