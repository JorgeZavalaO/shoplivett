import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listExpiredReservationsAction } from "@/actions/order-expiry";
import { requireRole } from "@/lib/permissions";
import { formatWhatsAppDisplay } from "@/lib/phone";
import { ExpireReservationForm } from "@/components/forms/expire-reservation-form";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string | string[];
  page?: string | string[];
}>;

export default async function PedidosVencidosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["ADMIN", "SELLER"]);
  const sp = await searchParams;
  const q = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const pageRaw = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const page = pageRaw ? Math.max(1, Number(pageRaw)) || 1 : 1;

  const result = await listExpiredReservationsAction({
    query: q ?? "",
    page,
    perPage: 20,
  });

  if (result.items.length === 0 && page > 1) {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2"
          render={
            <Link href="/pedidos">
              <ArrowLeft className="size-4" /> Pedidos
            </Link>
          }
        />
        <h1 className="text-2xl font-semibold tracking-tight">Reservas vencidas</h1>
        <p className="text-sm text-muted-foreground">
          Pedidos cuya fecha de vencimiento ya pasó. Cancelar libera el stock
          reservado y rechaza pagos pendientes del pedido. La acción es
          transaccional.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {result.items.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No hay reservas vencidas por ahora.
            </CardContent>
          </Card>
        ) : (
          result.items.map((o) => {
            const whatsappLink = `https://wa.me/${o.customer.whatsapp.replace(/[^\d]/g, "")}`;
            return (
              <Card key={o.id}>
                <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="text-base">
                      <Link
                        href={`/pedidos/${o.id}`}
                        className="font-mono hover:underline"
                      >
                        {o.orderNumber}
                      </Link>
                    </CardTitle>
                    <CardDescription>
                      <Link
                        href={`/clientes/${o.customer.id}`}
                        className="hover:underline"
                      >
                        {o.customer.name}
                      </Link>
                      {" · "}
                      <a
                        href={whatsappLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {formatWhatsAppDisplay(o.customer.whatsapp)}
                      </a>
                    </CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-right text-xs text-muted-foreground">
                    <Badge variant="destructive">Vencida</Badge>
                    <span>
                      Venció:{" "}
                      {new Intl.DateTimeFormat("es-PE", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(o.expiresAt))}
                    </span>
                    <span>
                      Saldo: S/ {o.balance} · Total: S/ {o.total}
                    </span>
                    <span>
                      {o.totalUnits} unidad(es) en {o.itemCount} item(s)
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ExpireReservationForm orderId={o.id} />
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {result.total === 0
            ? "Sin reservas vencidas"
            : `Mostrando ${(result.page - 1) * result.perPage + 1}–${Math.min(
                result.page * result.perPage,
                result.total,
              )} de ${result.total}`}
        </span>
        <span>
          Página {result.page} de {Math.max(1, Math.ceil(result.total / result.perPage))}
        </span>
      </div>
    </div>
  );
}
