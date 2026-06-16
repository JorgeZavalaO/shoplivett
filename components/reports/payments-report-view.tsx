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
import { Badge } from "@/components/ui/badge";
import { PaymentStatusBadge } from "@/components/dashboard/payment-status-badge";
import { PAYMENT_METHOD_LABELS } from "@/lib/settings-defaults";
import type { PaymentReportItem, PaymentsReport } from "@/lib/reports";

type Props = {
  data: PaymentsReport;
};

const DATE_FORMATTER = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "short",
  timeStyle: "short",
});

export function PaymentsReportView({ data }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-3">
        <BreakdownCard
          title="Por método"
          items={data.byMethod.map((m) => ({
            label: PAYMENT_METHOD_LABELS[m.method] ?? m.method,
            amount: m.amount,
            count: m.count,
          }))}
        />
        <BreakdownCard
          title="Por estado"
          items={data.byStatus.map((s) => ({
            label: s.status,
            amount: s.amount,
            count: s.count,
            badge: <PaymentStatusBadge status={s.status} />,
          }))}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pagos</CardTitle>
          <CardDescription>
            {data.total === 0
              ? "Sin pagos en el rango seleccionado."
              : `Mostrando ${data.items.length} de ${data.total} pago(s).`}
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
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Validado</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((p: PaymentReportItem) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {DATE_FORMATTER.format(new Date(p.createdAt))}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/clientes/${p.customer.id}`}
                          className="text-sm hover:underline"
                        >
                          {p.customer.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        S/ {p.amount}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.validatedAt
                          ? DATE_FORMATTER.format(new Date(p.validatedAt))
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <PaymentStatusBadge status={p.status} />
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/pagos/${p.id}`}
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

function BreakdownCard({
  title,
  items,
}: {
  title: string;
  items: Array<{
    label: string;
    amount: string;
    count: number;
    badge?: React.ReactNode;
  }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5 text-sm">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin datos.</p>
        ) : (
          items.map((it) => (
            <div
              key={it.label}
              className="flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2">
                {it.badge ?? (
                  <Badge variant="outline" className="text-[10px]">
                    {it.label}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {it.count} pago(s)
                </span>
              </div>
              <span className="font-mono text-xs">S/ {it.amount}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
