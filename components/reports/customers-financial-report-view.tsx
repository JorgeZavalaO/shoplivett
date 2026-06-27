import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SummaryCard } from "@/components/reports/summary-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CsvDownloadButton } from "@/components/reports/csv-download-button";
import type { CustomersFinancialReport } from "@/lib/financial-reports";

function fmtMoney(value: string): string {
  return `S/ ${value}`;
}

export function CustomersFinancialReportView({
  data,
  csvHref,
}: {
  data: CustomersFinancialReport;
  csvHref: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <SummaryCard
          title="Clientes"
          value={String(data.totals.customers)}
        />
        <SummaryCard
          title="Pedidos"
          value={String(data.totals.ordersCount)}
          hint={`${data.totals.paidOrdersCount} PAID`}
        />
        <SummaryCard
          title="Facturado"
          value={fmtMoney(data.totals.totalBilled)}
          tone="success"
        />
        <SummaryCard
          title="Cobrado"
          value={fmtMoney(data.totals.totalPaid)}
        />
        <SummaryCard
          title="Saldo pendiente"
          value={fmtMoney(data.totals.totalPending)}
          tone={data.totals.totalPendingCents > 0 ? "warning" : "default"}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="text-base">Resumen financiero por cliente</CardTitle>
            <CardDescription>
              Total facturado, cobrado, saldo pendiente y credito disponible.
              {data.query ? ` Filtro: "${data.query}".` : ""}
            </CardDescription>
          </div>
          <CsvDownloadButton href={csvHref} />
        </CardHeader>
        <CardContent>
          {data.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin clientes en el filtro.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Pedidos</TableHead>
                    <TableHead className="text-right">PAID</TableHead>
                    <TableHead className="text-right">Facturado</TableHead>
                    <TableHead className="text-right">Cobrado</TableHead>
                    <TableHead className="text-right">Pendiente</TableHead>
                    <TableHead className="text-right">Credito</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((r) => (
                    <TableRow key={r.customerId}>
                      <TableCell>
                        <a
                          href={`/clientes/${r.customerId}`}
                          className="font-medium hover:underline"
                        >
                          {r.customerName}
                        </a>
                      </TableCell>
                      <TableCell className="text-xs">{r.whatsapp}</TableCell>
                      <TableCell className="text-xs">{r.status}</TableCell>
                      <TableCell className="text-right">{r.ordersCount}</TableCell>
                      <TableCell className="text-right">{r.paidOrdersCount}</TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(r.totalBilled)}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(r.totalPaid)}
                      </TableCell>
                      <TableCell
                        className={`text-right ${
                          r.totalPendingCents > 0 ? "text-amber-600" : ""
                        }`}
                      >
                        {fmtMoney(r.totalPending)}
                      </TableCell>
                      <TableCell className="text-right text-emerald-600">
                        {fmtMoney(r.creditAvailable)}
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
