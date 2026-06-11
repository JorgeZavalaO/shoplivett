import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { listOrdersAction } from "@/actions/orders";
import { listExpiredReservationsAction } from "@/actions/order-expiry";
import { OrdersTable } from "@/components/tables/orders-table";
import { Button } from "@/components/ui/button";

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
  const expired = await listExpiredReservationsAction({ page: 1, perPage: 1 });

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
        <p className="text-sm text-muted-foreground">
          Pedidos creados desde venta rápida. Filtra por estado o busca por
          número o clienta.
        </p>
      </div>
      {expired.total > 0 ? (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4" />
            <span>
              Hay {expired.total} reserva(s) vencida(s) que requieren cancelación
              para liberar stock.
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            render={
              <Link href="/pedidos/vencidos">Ir a reservas vencidas</Link>
            }
          />
        </div>
      ) : null}
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
