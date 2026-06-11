import Link from "next/link";
import { Plus } from "lucide-react";

import { listPaymentsAction } from "@/actions/payments";
import { PaymentsTable } from "@/components/tables/payments-table";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string | string[];
  page?: string | string[];
  status?: string | string[];
}>;

const VALID_STATUSES = ["ALL", "PENDING", "VALIDATED", "REJECTED"] as const;
type StatusFilter = (typeof VALID_STATUSES)[number];

function parseStatus(value: string | undefined): StatusFilter {
  if (value && (VALID_STATUSES as readonly string[]).includes(value)) {
    return value as StatusFilter;
  }
  return "ALL";
}

export default async function PagosPage({
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
  const status = parseStatus(statusRaw);

  const result = await listPaymentsAction({
    query: q ?? "",
    status,
    page,
    perPage: 20,
  });

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pagos</h1>
          <p className="text-sm text-muted-foreground">
            Registra, valida o rechaza pagos manuales. La validación se hace
            desde el detalle.
          </p>
        </div>
        <Button render={<Link href="/pagos/nuevo"><Plus className="size-4" /> Registrar pago</Link>} />
      </div>
      <PaymentsTable
        items={result.items as never}
        total={result.total}
        page={result.page}
        perPage={result.perPage}
        status={result.status}
        query={result.query}
      />
    </div>
  );
}
