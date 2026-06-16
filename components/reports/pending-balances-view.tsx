import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import type {
  PendingBalancesReport,
  PendingBalanceRow,
} from "@/lib/reports";

const ORDER_STATUS_LABELS: Record<string, string> = {
  PAYMENT_VALIDATION_PENDING: "Validación pendiente",
  RESERVED: "Reservada",
  PARTIALLY_PAID: "Saldo pendiente",
};

const DATE_FORMATTER = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "short",
});

type Props = {
  data: PendingBalancesReport;
};

export function PendingBalancesView({ data }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Deuda activa</CardDescription>
            <CardTitle className="text-2xl text-amber-600">
              S/ {data.totalBalance}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Suma de saldos pendientes en pedidos con reserva o validación.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top clientas con deuda</CardTitle>
            <CardDescription>
              Suma de saldos pendientes por clienta.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5 text-sm">
            {data.byCustomer.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin deuda activa.</p>
            ) : (
              data.byCustomer.map((c) => (
                <div
                  key={c.customerId}
                  className="flex items-center justify-between gap-2"
                >
                  <Link
                    href={`/clientes/${c.customerId}`}
                    className="hover:underline"
                  >
                    {c.customerName}
                  </Link>
                  <span className="font-mono text-xs text-amber-600">
                    S/ {c.balance} · {c.ordersCount} pedido(s)
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pedidos con saldo</CardTitle>
          <CardDescription>
            {data.total === 0
              ? "No hay pedidos con saldo pendiente."
              : `Mostrando ${data.items.length} de ${data.total}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ajusta los filtros para ver resultados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Validado</TableHead>
                    <TableHead>Saldo</TableHead>
                    <TableHead>Vence</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((o: PendingBalanceRow) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">
                        {o.orderNumber}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/clientes/${o.customer.id}`}
                          className="hover:underline"
                        >
                          {o.customer.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <OrderStatusBadge status={o.status} />
                          <span className="text-[10px] text-muted-foreground">
                            {ORDER_STATUS_LABELS[o.status] ?? o.status}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        S/ {o.total}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-emerald-600">
                        S/ {o.validatedPaid}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-amber-600">
                        S/ {o.balance}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {DATE_FORMATTER.format(new Date(o.expiresAt))}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/pedidos/${o.id}`}
                          className="text-xs text-primary hover:underline"
                        >
                          Ver
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
