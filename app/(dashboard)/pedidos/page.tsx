import { listOrdersAction } from "@/actions/orders";
import { OrdersTable } from "@/components/tables/orders-table";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string | string[];
  page?: string | string[];
  status?: string | string[];
}>;

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const q = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const pageRaw = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const statusRaw = Array.isArray(sp.status) ? sp.status[0] : sp.status;
  const page = pageRaw ? Math.max(1, Number(pageRaw)) || 1 : 1;
  const status = statusRaw || "ALL";

  const result = await listOrdersAction({
    query: q ?? "",
    status,
    page,
    perPage: 20,
  });

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
        <p className="text-sm text-muted-foreground">
          Pedidos creados desde venta rápida. Filtra por estado o busca por
          número o clienta.
        </p>
      </div>
      <OrdersTable
        items={result.items}
        total={result.total}
        page={result.page}
        perPage={result.perPage}
        status={status}
        query={q ?? ""}
      />
    </div>
  );
}
