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
import type { FinancialExpensesReport } from "@/lib/financial-reports";

function fmtMoney(value: string): string {
  return `S/ ${value}`;
}

export function FinancialExpensesView({
  data,
  csvHref,
}: {
  data: FinancialExpensesReport;
  csvHref: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard
          title="Total activo"
          value={fmtMoney(data.totals.active)}
          tone="warning"
          hint={`${data.totals.count} gasto(s)`}
        />
        <SummaryCard
          title="Total anulado"
          value={fmtMoney(data.totals.voided)}
        />
        <SummaryCard
          title="Filtro aplicado"
          value={[
            data.category !== "ALL" ? `Cat: ${data.category}` : null,
            data.type !== "ALL" ? `Tipo: ${data.type}` : null,
            data.status !== "ALL" ? `Estado: ${data.status}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Sin filtro"}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="text-base">Gastos operativos</CardTitle>
            <CardDescription>
              Publicidad, sueldos, servicios, empaque, envios y mas.
            </CardDescription>
          </div>
          <CsvDownloadButton href={csvHref} />
        </CardHeader>
        <CardContent>
          {data.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin gastos en el filtro.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Detalle</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Medio</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">
                        {r.expenseDate.toISOString().slice(0, 10)}
                      </TableCell>
                      <TableCell className="text-xs">{r.categoryLabel}</TableCell>
                      <TableCell className="text-xs">{r.expenseTypeLabel}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {r.description}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(r.amount)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.paymentMethod ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        <span
                          className={
                            r.status === "ACTIVE"
                              ? "text-emerald-600"
                              : "text-muted-foreground"
                          }
                        >
                          {r.status}
                        </span>
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
