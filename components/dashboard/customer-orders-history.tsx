"use client";

import { useState } from "react";
import Link from "next/link";
import { ShoppingBag, ChevronLeft, ChevronRight } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listCustomerOrdersAction, type CustomerOrderItem } from "@/actions/orders";
import { OrderStatusBadge, type OrderStatus } from "@/components/dashboard/order-status-badge";

type Props = {
  customerId: string;
  initialData: {
    items: CustomerOrderItem[];
    total: number;
    page: number;
    perPage: number;
  };
};

export function CustomerOrdersHistory({ customerId, initialData }: Props) {
  const [page, setPage] = useState(initialData.page);
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const totalPages = Math.ceil(data.total / data.perPage);

  async function loadPage(newPage: number) {
    setLoading(true);
    const result = await listCustomerOrdersAction(customerId, { page: newPage, perPage: data.perPage });
    setData(result);
    setPage(newPage);
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShoppingBag className="size-4 text-muted-foreground" />
          Pedidos
        </CardTitle>
        <CardDescription>
          {data.total === 0
            ? "Esta clienta aún no tiene pedidos."
            : `${data.total} pedido(s).`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Los pedidos se crean desde el módulo de Ventas.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {data.items.map((o) => (
              <Link
                key={o.id}
                href={`/pedidos/${o.id}`}
                className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted"
              >
                <div>
                  <p className="text-sm font-medium font-mono">{o.orderNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat("es-PE", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(o.createdAt))}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <p className="text-sm">S/ {o.total}</p>
                    {Number(o.balance) > 0 && (
                      <p className="text-xs text-muted-foreground">
                        saldo S/ {o.balance}
                      </p>
                    )}
                  </div>
                  <OrderStatusBadge status={o.status as OrderStatus} />
                </div>
              </Link>
            ))}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-muted-foreground">
                  Pág. {page} de {totalPages}
                </p>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1 || loading}
                    onClick={() => loadPage(page - 1)}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages || loading}
                    onClick={() => loadPage(page + 1)}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
