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
import { StockHealthBadge } from "@/components/financial/stock-health-badge";
import type { StockValuationReport } from "@/lib/financial-reports";

function fmtMoney(value: string): string {
  return `S/ ${value}`;
}

export function StockValuationReportView({
  data,
  csvHref,
}: {
  data: StockValuationReport;
  csvHref: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard
          title="Valor total"
          value={fmtMoney(data.totals.total)}
          tone="success"
          hint={`${data.totals.units} unidades`}
        />
        <SummaryCard
          title="Con lote"
          value={String(data.totals.variantsWithBatches)}
          hint="Costo aterrizado disponible"
        />
        <SummaryCard
          title="Sin lote (legado)"
          value={String(data.totals.variantsWithoutBatches)}
          tone="warning"
          hint="Fallback a ProductVariant.cost"
        />
        <SummaryCard
          title="Stock legado (valor)"
          value={fmtMoney(data.totals.legacyTotal)}
          tone="warning"
        />
      </div>

      {data.totals.variantsWithoutBatches > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          Hay {data.totals.variantsWithoutBatches} variante(s) usando costo legado. El valor total puede cambiar cuando migren a lotes.
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="text-base">Stock valorizado</CardTitle>
            <CardDescription>
              Valor del stock a costo aterrizado (lotes) o costo legado.
            </CardDescription>
          </div>
          <CsvDownloadButton href={csvHref} />
        </CardHeader>
        <CardContent>
          {data.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin stock valorizado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Variante</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Disponible</TableHead>
                    <TableHead>Origen costo</TableHead>
                    <TableHead className="text-right">Unitario</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((r) => (
                    <TableRow key={r.variantId}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{r.productName}</span>
                          {r.color ? (
                            <span className="text-xs text-muted-foreground">
                              {r.color}
                              {r.size ? ` · ${r.size}` : ""}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.variantCode}
                      </TableCell>
                      <TableCell className="text-xs">{r.categoryName}</TableCell>
                      <TableCell className="text-right">{r.stock}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end">
                          <StockHealthBadge availableUnits={r.available} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            r.hasBatches
                              ? "text-emerald-600 text-xs"
                              : "text-amber-600 text-xs"
                          }
                        >
                          {r.hasBatches ? "Lote" : "Legado"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(r.unitCost)}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(r.totalCost)}
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
