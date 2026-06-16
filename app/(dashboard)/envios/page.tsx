import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";

import { listShipmentsAction } from "@/actions/shipments";
import { ShipmentsTable } from "@/components/tables/shipments-table";

export const metadata: Metadata = { title: "Envíos" };
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/permissions";


type SearchParams = Promise<{
  q?: string | string[];
  page?: string | string[];
  status?: string | string[];
}>;

const VALID_STATUSES = [
  "ALL",
  "PENDING",
  "PREPARING",
  "READY",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;
type StatusFilter = (typeof VALID_STATUSES)[number];

function parseStatus(value: string | undefined): StatusFilter {
  if (value && (VALID_STATUSES as readonly string[]).includes(value)) {
    return value as StatusFilter;
  }
  return "ALL";
}

export default async function EnviosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["ADMIN", "DISPATCH"]);
  const sp = await searchParams;
  const q = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const pageRaw = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const statusRaw = Array.isArray(sp.status) ? sp.status[0] : sp.status;
  const page = pageRaw ? Math.max(1, Number(pageRaw)) || 1 : 1;
  const status = parseStatus(statusRaw);

  const result = await listShipmentsAction({
    query: q ?? "",
    status,
    page,
    perPage: 20,
  });

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Envíos</h1>
          <p className="text-sm text-muted-foreground">
            Agrupa pedidos pagados de una misma clienta y hazles seguimiento
            desde la preparación hasta la entrega.
          </p>
        </div>
        <Button render={<Link href="/envios/nuevo"><Plus className="size-4" /> Nuevo envío</Link>} />
      </div>
      <ShipmentsTable
        items={result.items}
        total={result.total}
        page={result.page}
        perPage={result.perPage}
        status={result.status}
        query={result.query}
      />
    </div>
  );
}
