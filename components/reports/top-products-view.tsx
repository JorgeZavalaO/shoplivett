import Link from "next/link";

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
import { Badge } from "@/components/ui/badge";
import type { TopProductRow, TopProductsReport } from "@/lib/reports";

type Props = {
  data: TopProductsReport;
  hasRange: boolean;
};

export function TopProductsView({ data, hasRange }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Unidades vendidas</CardDescription>
            <CardTitle className="text-2xl">
              {data.totals.unitsSold}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {hasRange
              ? "Suma en el rango seleccionado."
              : "Acumulado histórico."}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Ingresos</CardDescription>
            <CardTitle className="text-2xl text-emerald-600">
              S/ {data.totals.revenue}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {hasRange
              ? "Suma de lineTotal en el rango."
              : "Sin rango: sólo se muestran unidades."}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Variantes listadas</CardDescription>
            <CardTitle className="text-2xl">{data.items.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top productos</CardTitle>
          <CardDescription>
            {data.items.length === 0
              ? "Sin datos en el rango seleccionado."
              : hasRange
                ? "Ordenado por unidades vendidas en el rango."
                : "Acumulado actual por variantes activas."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ajusta los filtros para ver resultados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Tamaño</TableHead>
                    <TableHead>Unidades</TableHead>
                    <TableHead>Ingresos</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((p: TopProductRow) => (
                    <TableRow key={p.variantId}>
                      <TableCell className="font-medium">
                        {p.productName}
                        <p className="text-[10px] text-muted-foreground">
                          {p.categoryName}
                        </p>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {p.code}
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.color ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.size ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{p.unitsSold}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        S/ {p.revenue}
                      </TableCell>
                      <TableCell className="text-xs">
                        Stock {p.stock} · Disp {p.available}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/inventario/${p.variantId}`}
                          className="text-xs text-primary hover:underline"
                        >
                          Ver
                        </Link>
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
