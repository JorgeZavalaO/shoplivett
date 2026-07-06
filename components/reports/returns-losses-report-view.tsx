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
import { ReportLimitNotice } from "@/components/reports/report-limit-notice";
import { IncidentImpactBadge } from "@/components/financial/incident-impact-badge";
import type { ReturnsLossesReport } from "@/lib/financial-reports";

function fmtMoney(value: string): string {
  return `S/ ${value}`;
}

export function ReturnsLossesReportView({
  data,
  csvHref,
}: {
  data: ReturnsLossesReport;
  csvHref: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard
          title="Total perdido"
          value={fmtMoney(data.totals.lost)}
          tone="destructive"
        />
        <SummaryCard
          title="Total recuperado"
          value={fmtMoney(data.totals.recovered)}
          tone="success"
        />
        <SummaryCard
          title="Neto"
          value={fmtMoney(data.totals.net)}
          tone={data.totals.netCents < 0 ? "destructive" : "success"}
        />
      </div>

      <ReportLimitNotice meta={data.meta} />

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="text-base">Devoluciones y perdidas</CardTitle>
            <CardDescription>
              Incidencias del rango. Los totales excluyen incidencias canceladas.
            </CardDescription>
          </div>
          <CsvDownloadButton href={csvHref} />
        </CardHeader>
        <CardContent>
          {data.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin incidencias en el rango.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Impacto</TableHead>
                    <TableHead>Decision</TableHead>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Cant.</TableHead>
                    <TableHead className="text-right">Restock</TableHead>
                    <TableHead className="text-right">Recuperado</TableHead>
                    <TableHead className="text-right">Perdido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((r) => (
                    <TableRow key={r.incidentId}>
                      <TableCell className="text-xs">
                        {r.incidentDate.toISOString().slice(0, 10)}
                      </TableCell>
                      <TableCell className="text-xs">{r.typeLabel}</TableCell>
                      <TableCell className="text-xs">{r.status}</TableCell>
                      <TableCell>
                        <IncidentImpactBadge
                          status={r.status}
                          lostCents={r.lostCents}
                          recoveredCents={r.recoveredCents}
                        />
                      </TableCell>
                      <TableCell className="text-xs">{r.decisionLabel}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.orderNumber ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{r.productName ?? "—"}</span>
                          {r.variantCode ? (
                            <span className="text-xs text-muted-foreground">
                              {r.variantCode}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.customerName ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">{r.quantity}</TableCell>
                      <TableCell className="text-right">
                        {r.restockQuantity}
                      </TableCell>
                      <TableCell className="text-right text-emerald-600">
                        {fmtMoney(r.recovered)}
                      </TableCell>
                      <TableCell
                        className={`text-right ${
                          r.lostCents > 0 ? "text-destructive" : ""
                        }`}
                      >
                        {fmtMoney(r.lost)}
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
