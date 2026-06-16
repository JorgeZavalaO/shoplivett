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
import { PAYMENT_METHOD_LABELS } from "@/lib/settings-defaults";
import type { CreditReportItem, CreditsReport } from "@/lib/reports";

const ORIGIN_LABELS: Record<CreditReportItem["origin"], string> = {
  OVERPAYMENT: "Sobrepago",
  MANUAL: "Manual",
  REFUND: "Devolución",
};

const STATUS_LABELS: Record<CreditReportItem["status"], string> = {
  AVAILABLE: "Disponible",
  PARTIALLY_USED: "Parcial",
  USED: "Usado",
  REFUNDED: "Devuelto",
  VOIDED: "Anulado",
};

const STATUS_CLASS: Record<CreditReportItem["status"], string> = {
  AVAILABLE: "bg-emerald-600 text-white",
  PARTIALLY_USED: "bg-blue-200 text-blue-900",
  USED: "",
  REFUNDED: "bg-amber-500 text-white",
  VOIDED: "bg-muted text-muted-foreground",
};

const DATE_FORMATTER = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "short",
  timeStyle: "short",
});

type Props = {
  data: CreditsReport;
};

export function CreditsReportView({ data }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        <BreakdownCard
          title="Por estado"
          items={data.byStatus.map((s) => ({
            label: STATUS_LABELS[s.status] ?? s.status,
            amount: s.amount,
            count: s.count,
            className: STATUS_CLASS[s.status] || undefined,
          }))}
        />
        <BreakdownCard
          title="Por origen"
          items={data.byOrigin.map((s) => ({
            label: ORIGIN_LABELS[s.origin] ?? s.origin,
            amount: s.amount,
            count: s.count,
          }))}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Créditos</CardTitle>
          <CardDescription>
            {data.total === 0
              ? "Sin créditos en el rango seleccionado."
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
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Disponible</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Pago</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((c: CreditReportItem) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {DATE_FORMATTER.format(new Date(c.createdAt))}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/clientes/${c.customer.id}`}
                          className="hover:underline"
                        >
                          {c.customer.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        {ORIGIN_LABELS[c.origin] ?? c.origin}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        S/ {c.amount}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        S/ {c.availableAmount}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_CLASS[c.status]}>
                          {STATUS_LABELS[c.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {c.payment
                          ? `${PAYMENT_METHOD_LABELS[c.payment.method] ?? c.payment.method} · S/ ${c.payment.amount}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {c.notes ? (
                          <span className="text-xs text-muted-foreground">
                            {c.notes}
                          </span>
                        ) : null}
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
    className?: string;
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
                <Badge
                  variant="outline"
                  className={`text-[10px] ${it.className ?? ""}`}
                >
                  {it.label}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {it.count} crédito(s)
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
