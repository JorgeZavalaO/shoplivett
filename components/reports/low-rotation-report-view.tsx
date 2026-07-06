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
import { RotationBadge } from "@/components/financial/rotation-badge";
import { StockHealthBadge } from "@/components/financial/stock-health-badge";
import type { LowRotationReport } from "@/lib/financial-reports";

function fmtMoney(value: string): string {
  return `S/ ${value}`;
}

export function LowRotationReportView({
  data,
  csvHref,
}: {
  data: LowRotationReport;
  csvHref: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard
          title="Umbral"
          value={`${data.thresholdDays} dias`}
          hint="Variantes sin ventas en este periodo"
        />
        <SummaryCard
          title="Unidades sin rotacion"
          value={String(data.totals.units)}
          tone="warning"
        />
        <SummaryCard
          title="Capital inmovilizado"
          value={fmtMoney(data.totals.value)}
          tone="warning"
        />
      </div>

      {data.rows.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          Estos productos mantienen capital inmovilizado sin ventas recientes. Prioriza rotacion, rebundles o ajuste de precio.
        </div>
      ) : null}

      <ReportLimitNotice meta={data.meta} />

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="text-base">Productos sin rotacion</CardTitle>
            <CardDescription>
              Variantes con stock sin ventas en los ultimos {data.thresholdDays} dias.
            </CardDescription>
          </div>
          <CsvDownloadButton href={csvHref} />
        </CardHeader>
        <CardContent>
          {data.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todas las variantes tienen ventas recientes.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Variante</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Reservado</TableHead>
                    <TableHead className="text-right">Vendido</TableHead>
                    <TableHead className="text-right">Valor stock</TableHead>
                    <TableHead className="text-right">Ultima venta</TableHead>
                    <TableHead className="text-right">Dias sin venta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((r) => (
                    <TableRow key={r.variantId}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{r.productName}</span>
                          <span className="text-xs text-muted-foreground">
                            {r.categoryName}
                            {r.color ? ` · ${r.color}` : ""}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.variantCode}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end">
                          <StockHealthBadge
                            availableUnits={Math.max(
                              0,
                              r.stock - r.reservedStock - r.soldStock,
                            )}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{r.reservedStock}</TableCell>
                      <TableCell className="text-right">{r.soldStock}</TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(r.stockValue)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {r.lastSoldAt
                          ? r.lastSoldAt.toISOString().slice(0, 10)
                          : "Nunca"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end">
                          <RotationBadge
                            daysSinceLastSale={r.daysSinceLastSale}
                            thresholdDays={data.thresholdDays}
                          />
                        </div>
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
