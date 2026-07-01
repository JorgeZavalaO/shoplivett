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
import { MarginBadge } from "@/components/financial/margin-badge";
import { StockHealthBadge } from "@/components/financial/stock-health-badge";
import type { ProductProfitabilityReport } from "@/lib/financial-reports";

function fmtMoney(value: string): string {
  return `S/ ${value}`;
}

export function ProductProfitabilityReportView({
  data,
  csvHref,
}: {
  data: ProductProfitabilityReport;
  csvHref: string;
}) {
  const lowMarginRows = data.rows.filter((row) => row.marginBps < 1500);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard
          title="Unidades vendidas"
          value={String(data.totals.unitsSold)}
          hint="Lineas con costo congelado (BATCH/LEGACY)"
        />
        <SummaryCard
          title="Ingreso (rango)"
          value={fmtMoney(data.totals.revenue)}
          tone="success"
        />
        <SummaryCard
          title="Costo (rango)"
          value={fmtMoney(data.totals.cost)}
        />
        <SummaryCard
          title="Utilidad bruta (rango)"
          value={fmtMoney(data.totals.grossProfit)}
          tone={data.totals.grossProfitCents < 0 ? "destructive" : "default"}
        />
      </div>

      {lowMarginRows.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          {lowMarginRows.length} variante(s) del reporte tienen margen por debajo de 15%.
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="text-base">Utilidad por producto</CardTitle>
            <CardDescription>
              Top productos por utilidad bruta con snapshots de costo real.
              {data.categoryId ? " Filtrado por categoria." : ""}
            </CardDescription>
          </div>
          <CsvDownloadButton href={csvHref} />
        </CardHeader>
        <CardContent>
          {data.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin ventas en el rango.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Variante</TableHead>
                    <TableHead className="text-right">Uds</TableHead>
                    <TableHead className="text-right">Ingreso</TableHead>
                    <TableHead className="text-right">Costo</TableHead>
                    <TableHead className="text-right">Utilidad</TableHead>
                    <TableHead className="text-right">Margen</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
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
                      <TableCell className="text-right">{r.unitsSold}</TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(r.revenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(r.cost)}
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
                      <TableCell className="text-right">
                        <div className="flex justify-end">
                          <MarginBadge bps={r.marginBps} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end">
                          <StockHealthBadge availableUnits={r.stock} />
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
