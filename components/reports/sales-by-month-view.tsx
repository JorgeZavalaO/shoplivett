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
import type { SalesByMonthReport } from "@/lib/financial-reports";

function fmtMoney(value: string): string {
  return `S/ ${value}`;
}

function fmtPct(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}

export function SalesByMonthView({
  data,
  csvHref,
}: {
  data: SalesByMonthReport;
  csvHref: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard
          title="Ventas (rango)"
          value={fmtMoney(data.totals.revenue)}
          hint={`${data.totals.ordersCount} pedido(s) PAID`}
          tone="success"
        />
        <SummaryCard
          title="Costo (rango)"
          value={fmtMoney(data.totals.productCost)}
        />
        <SummaryCard
          title="Utilidad bruta (rango)"
          value={fmtMoney(data.totals.grossProfit)}
        />
        <SummaryCard
          title="Utilidad neta (rango)"
          value={fmtMoney(data.totals.netProfit)}
          tone={data.totals.netProfitCents < 0 ? "destructive" : "default"}
          hint={
            data.totals.revenueCents > 0
              ? `Margen ${fmtPct(Math.round((data.totals.netProfitCents * 10000) / data.totals.revenueCents))}`
              : undefined
          }
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="text-base">Ventas por mes</CardTitle>
            <CardDescription>
              Ventas reconocidas (PAID) con snapshots financieros historicos.
              Costos congelados por linea.
            </CardDescription>
          </div>
          <CsvDownloadButton href={csvHref} />
        </CardHeader>
        <CardContent>
          {data.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin ventas reconocidas en el rango.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Periodo</TableHead>
                    <TableHead className="text-right">Pedidos</TableHead>
                    <TableHead className="text-right">Ventas</TableHead>
                    <TableHead className="text-right">Costo</TableHead>
                    <TableHead className="text-right">Utilidad bruta</TableHead>
                    <TableHead className="text-right">Empaque</TableHead>
                    <TableHead className="text-right">Fee</TableHead>
                    <TableHead className="text-right">Utilidad neta</TableHead>
                    <TableHead className="text-right">Margen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((r) => (
                    <TableRow key={`${r.year}-${r.month}`}>
                      <TableCell className="font-medium">
                        {r.monthLabel}
                      </TableCell>
                      <TableCell className="text-right">{r.ordersCount}</TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(r.revenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(r.productCost)}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(r.grossProfit)}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(r.packagingCost)}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(r.paymentFee)}
                      </TableCell>
                      <TableCell
                        className={`text-right ${
                          r.netProfitCents < 0
                            ? "text-destructive"
                            : "text-emerald-600"
                        }`}
                      >
                        {fmtMoney(r.netProfit)}
                      </TableCell>
                      <TableCell
                        className={`text-right ${
                          r.marginBps < 0
                            ? "text-destructive"
                            : r.marginBps < 1500
                              ? "text-amber-600"
                              : ""
                        }`}
                      >
                        {fmtPct(r.marginBps)}
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
