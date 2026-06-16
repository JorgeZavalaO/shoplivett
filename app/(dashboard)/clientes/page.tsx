import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CustomersTable } from "@/components/tables/customers-table";

export const metadata: Metadata = { title: "Clientes" };
import { searchCustomersAction } from "@/actions/customers";
import { requireRole } from "@/lib/permissions";


type SearchParams = Promise<{ q?: string | string[]; page?: string | string[] }>;

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["ADMIN", "SELLER"]);
  const sp = await searchParams;
  const q = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const pageRaw = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const page = pageRaw ? Math.max(1, Number(pageRaw)) || 1 : 1;

  const result = await searchCustomersAction(q ?? "", page, 20);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            Clientas registradas. Busca por nombre o WhatsApp.
          </p>
        </div>
        <Button render={<Link href="/clientes/nuevo"><Plus className="size-4" /> Nueva clienta</Link>} />
      </div>

      <CustomersTable
        items={result.items}
        total={result.total}
        page={result.page}
        perPage={result.perPage}
        query={result.query}
      />
    </div>
  );
}
