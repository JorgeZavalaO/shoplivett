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
import type { BatchProfitabilityReport } from "@/lib/financial-reports";

function fmtMoney(value: string): string {
  return `S/ ${value}`;
}

function fmtPct(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}

export function BatchProfitabilityReportView({
  data,
  csvHref,
}: {
  data: BatchProfitabilityReport;
  csvHref: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard
          title="Inversion total"
          value={fmtMoney(data.totals.investment)}
          hint="Todos los lotes del rango"
        />
        <SummaryCard
          title="Uds vendidas"
          value={String(data.totals.soldUnits)}
        />
        <SummaryCard
          title="Ingreso asignado"
          value={fmtMoney(data.totals.allocatedRevenue)}
          tone="success"
        />
        <SummaryCard
          title="Utilidad asignada"
          value={fmtMoney(data.totals.grossProfit)}
          tone={data.totals.grossProfitCents < 0 ? "destructive" : "default"}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="text-base">Rentabilidad por lote</CardTitle>
            <CardDescription>
              Lotes con ventas reconocidas. ROI = utilidad / inversion total.
            </CardDescription>
          </div>
          <CsvDownloadButton href={csvHref} />
        </CardHeader>
        <CardContent>
          {data.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin lotes con ventas en el rango.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lote</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Uds vendidas</TableHead>
                    <TableHead className="text-right">Inversion</TableHead>
                    <TableHead className="text-right">Ingreso</TableHead>
                    <TableHead className="text-right">Costo</TableHead>
                    <TableHead className="text-right">Utilidad</TableHead>
                    <TableHead className="text-right">Margen</TableHead>
                    <TableHead className="text-right">ROI</TableHead>
                    <TableHead className="text-right">Disponible</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((r) => (
                    <TableRow key={r.batchId}>
                      <TableCell>
                        <div className="flex flex-col">
                          <a
                            href={`/lotes/${r.batchId}`}
                            className="font-mono text-xs hover:underline"
                          >
                            {r.batchCode}
                          </a>
                          <span className="text-xs text-muted-foreground">
                            {r.purchaseDate.toISOString().slice(0, 10)}
                            {r.shopper ? ` · ${r.shopper}` : ""}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{r.status}</TableCell>
                      <TableCell className="text-right">{r.soldUnits}</TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(r.investment)}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(r.allocatedRevenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(r.allocatedCost)}
                      </TableCell>
                      <TableCell
                        className={`text-right ${
                          r.grossProfitCents < 0
                            ? "text-destructive"
                            : "text-emerald-600"
                        }`}
                      >
                        {fmtMoney(r.grossProfit)}
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
                      <TableCell
                        className={`text-right ${
                          r.roiBps < 0 ? "text-destructive" : ""
                        }`}
                      >
                        {fmtPct(r.roiBps)}
                      </TableCell>
                      <TableCell className="text-right">{r.availableUnits}</TableCell>
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
