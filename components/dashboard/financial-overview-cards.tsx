import { DashboardMetricCard } from "@/components/dashboard/dashboard-metric-card";
import { BatchHealthBadge } from "@/components/financial/batch-health-badge";
import { MarginBadge } from "@/components/financial/margin-badge";
import { StockHealthBadge } from "@/components/financial/stock-health-badge";
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
import type {
  BatchProfitabilityRow,
  FinancialOverview,
  OpenBatchCapital,
  ProductProfitabilityRow,
  StockValuation,
} from "@/lib/financial-dashboard";

function fmtMoney(value: string): string {
  return `S/ ${value}`;
}

function fmtPct(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}

export function FinancialOverviewCards({
  overview,
}: {
  overview: FinancialOverview;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <DashboardMetricCard
        title="Ventas del mes"
        value={fmtMoney(overview.revenue)}
        hint={`${overview.ordersCount} pedido(s) PAID reconocidos`}
      />
      <DashboardMetricCard
        title="Costo de productos vendidos"
        value={fmtMoney(overview.productCost)}
        hint="Costo real congelado en OrderItem"
      />
      <DashboardMetricCard
        title="Utilidad bruta del mes"
        value={fmtMoney(overview.grossProfit)}
        tone={overview.grossProfitCents < 0 ? "destructive" : "default"}
        hint={`Margen bruto ${fmtPct(overview.revenueCents > 0 ? Math.round((overview.grossProfitCents * 10000) / overview.revenueCents) : 0)}`}
      />
      <DashboardMetricCard
        title="Gastos operativos del mes"
        value={fmtMoney(overview.expenses)}
        href="/gastos"
      />
      <DashboardMetricCard
        title="Perdidas por incidencias"
        value={fmtMoney(overview.incidentLoss)}
        tone={overview.incidentLossCents > 0 ? "destructive" : "default"}
        href="/incidencias"
      />
      <DashboardMetricCard
        title="Comision medio de pago"
        value={fmtMoney(overview.paymentFee)}
        hint="Fees por medio de pago aplicados al mes"
      />
      <DashboardMetricCard
        title="Costo de empaque"
        value={fmtMoney(overview.packagingCost)}
        hint="Configuracion financiera del negocio"
      />
      <DashboardMetricCard
        title="Utilidad neta real del mes"
        value={fmtMoney(overview.realNetProfit)}
        tone={overview.realNetProfitCents < 0 ? "destructive" : "success"}
        hint={`Margen real ${fmtPct(overview.marginBps)}`}
      />
    </div>
  );
}

export function StockValuationCards({ valuation }: { valuation: StockValuation }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <DashboardMetricCard
        title="Valor del stock actual"
        value={fmtMoney(valuation.total)}
        hint={`${valuation.totalUnits} unidades`}
        href="/inventario"
      />
      <DashboardMetricCard
        title="Variantes con lote"
        value={String(valuation.variantsWithBatches)}
        hint="Stock con costo aterrizado disponible"
      />
      <DashboardMetricCard
        title="Stock legado sin lote"
        value={fmtMoney(valuation.fallbackLegacyValue)}
        tone="warning"
        hint={`${valuation.variantsWithoutBatches} variante(s) usan ProductVariant.cost`}
      />
    </div>
  );
}

export function StockValuationByCategory({
  valuation,
}: {
  valuation: StockValuation;
}) {
  if (valuation.byCategory.length === 0) {
    return null;
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Stock valorizado por categoria</CardTitle>
        <CardDescription>
          Unidades disponibles a costo aterrizado (lotes) o costo legado
          (ProductVariant.cost).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Unidades</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {valuation.byCategory.map((row) => (
                <TableRow key={row.categoryId}>
                  <TableCell>{row.categoryName}</TableCell>
                  <TableCell className="text-right">{row.units}</TableCell>
                  <TableCell className="text-right">
                    {fmtMoney(row.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export function OpenBatchCapitalCards({
  capital,
}: {
  capital: OpenBatchCapital;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <DashboardMetricCard
        title="Capital inmovilizado en lotes"
        value={fmtMoney(capital.openBatchesValue)}
        tone="warning"
        hint={`Stock disponible ${capital.totalAvailableUnits} uds`}
        href="/lotes"
      />
      <DashboardMetricCard
        title="Inversion total acumulada"
        value={fmtMoney(capital.totalInvestment)}
        hint={`${capital.totalBatches} lote(s) registrado(s)`}
        href="/lotes"
      />
      <DashboardMetricCard
        title="Lotes abiertos"
        value={String(
          capital.byStatus
            .filter((s) => s.status !== "CLOSED")
            .reduce((acc, s) => acc + s.batches, 0),
        )}
        hint="Comprados + en transito + completos"
      />
      <DashboardMetricCard
        title="Lotes cerrados"
        value={String(
          capital.byStatus.find((s) => s.status === "CLOSED")?.batches ?? 0,
        )}
        hint="Stock agotado / finalizado"
      />
    </div>
  );
}

export function ProductProfitabilitySection({
  title,
  description,
  rows,
  viewAllHref,
  viewAllLabel,
}: {
  title: string;
  description: string;
  rows: ProductProfitabilityRow[];
  viewAllHref?: string;
  viewAllLabel?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {viewAllHref ? (
          <a
            href={viewAllHref}
            className="text-xs text-muted-foreground hover:underline"
          >
            {viewAllLabel ?? "Ver detalle"}
          </a>
        ) : null}
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin datos en el periodo seleccionado.
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
                  <TableHead className="text-right">Utilidad</TableHead>
                  <TableHead className="text-right">Margen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.variantId}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{r.productName}</span>
                        <span className="text-xs text-muted-foreground">
                          {r.categoryName}
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function BatchProfitabilitySection({
  rows,
}: {
  rows: BatchProfitabilityRow[];
}) {
  if (rows.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Rentabilidad por lote</CardTitle>
        <CardDescription>
          Lotes con ventas reconocidas. ROI = utilidad / inversion total del
          lote.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lote</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Uds vendidas</TableHead>
                <TableHead className="text-right">Ingreso</TableHead>
                <TableHead className="text-right">Utilidad</TableHead>
                <TableHead className="text-right">Margen</TableHead>
                <TableHead className="text-right">ROI</TableHead>
                <TableHead className="text-right">Stock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.batchId}>
                  <TableCell className="font-mono text-xs">
                    <a
                      href={`/lotes/${r.batchId}`}
                      className="hover:underline"
                    >
                      {r.batchCode}
                    </a>
                  </TableCell>
                  <TableCell>
                    <BatchHealthBadge
                      status={r.status}
                      marginBps={r.marginBps}
                      roiBps={r.roiBps}
                      availableUnits={r.availableUnits}
                    />
                  </TableCell>
                  <TableCell className="text-right">{r.soldUnits}</TableCell>
                  <TableCell className="text-right">
                    {fmtMoney(r.allocatedRevenue)}
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
                      <BatchHealthBadge roiBps={r.roiBps} />
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <StockHealthBadge availableUnits={r.availableUnits} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
