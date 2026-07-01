import { AlertTriangle, AlertOctagon, Info } from "lucide-react";

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
import { RotationBadge } from "@/components/financial/rotation-badge";
import { StockHealthBadge } from "@/components/financial/stock-health-badge";
import type { FinancialAlerts, LowRotationRow } from "@/lib/financial-dashboard";

const LEVEL_CLASS: Record<"warning" | "destructive" | "info", string> = {
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  destructive: "border-destructive/30 bg-destructive/5 text-destructive",
  info: "border-sky-200 bg-sky-50 text-sky-900",
};

function LevelIcon({ level }: { level: "warning" | "destructive" | "info" }) {
  if (level === "destructive") return <AlertOctagon className="size-4" />;
  if (level === "warning") return <AlertTriangle className="size-4" />;
  return <Info className="size-4" />;
}

export function FinancialAlertsList({ alerts }: { alerts: FinancialAlerts }) {
  if (alerts.alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alertas financieras</CardTitle>
          <CardDescription>
            Sin alertas activas para el periodo seleccionado.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Alertas financieras</CardTitle>
        <CardDescription>
          Riesgos detectados a partir de los pedidos, gastos, perdidas y
          capital inmovilizado.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2">
          {alerts.alerts.map((a, idx) => (
            <li
              key={`${a.title}-${idx}`}
              className={`flex items-start gap-3 rounded-md border px-3 py-2 text-sm ${LEVEL_CLASS[a.level]}`}
            >
              <span className="mt-0.5 shrink-0">
                <LevelIcon level={a.level} />
              </span>
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="font-medium">{a.title}</span>
                <span className="text-xs opacity-90">{a.description}</span>
              </div>
              {a.href ? (
                <a
                  href={a.href}
                  className="text-xs underline-offset-4 hover:underline"
                >
                  Revisar
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function fmtMoney(value: string): string {
  return `S/ ${value}`;
}

export function LowRotationSection({ rows }: { rows: LowRotationRow[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Productos sin rotacion</CardTitle>
          <CardDescription>
            Sin stock sin ventas recientes. Buen trabajo.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Productos sin rotacion</CardTitle>
        <CardDescription>
          Variantes con stock disponible que no registran ventas en el periodo
          indicado.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Variante</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Ultima venta</TableHead>
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
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <StockHealthBadge availableUnits={r.stock - r.reservedStock} />
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {fmtMoney(r.stockValue)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <RotationBadge
                        daysSinceLastSale={r.daysSinceLastSale}
                        thresholdDays={60}
                      />
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
