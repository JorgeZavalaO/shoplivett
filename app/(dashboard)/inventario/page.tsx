import { InventoryTable } from "@/components/tables/inventory-table";
import { getInventorySummaryAction } from "@/actions/inventory";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string | string[];
  page?: string | string[];
}>;

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const q = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const pageRaw = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const page = pageRaw ? Math.max(1, Number(pageRaw)) || 1 : 1;

  const result = await getInventorySummaryAction(q ?? "", page, 20);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inventario</h1>
        <p className="text-sm text-muted-foreground">
          Stock por variante. Las reservas y ventas se actualizan automáticamente
          desde los flujos de pedidos y pagos.
        </p>
      </div>

      <InventoryTable
        items={result.items}
        total={result.total}
        page={result.page}
        perPage={result.perPage}
        query={result.query}
      />
    </div>
  );
}
