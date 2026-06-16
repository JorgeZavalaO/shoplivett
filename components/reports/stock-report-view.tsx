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
import type { StockReport, StockReportRow } from "@/lib/reports";

const VARIANT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activa",
  HIDDEN: "Oculta",
  ARCHIVED: "Archivada",
};

type Props = {
  data: StockReport;
};

export function StockReportView({ data }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Stock total</CardDescription>
            <CardTitle className="text-2xl">{data.totals.stock}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Reservado</CardDescription>
            <CardTitle className="text-2xl text-amber-600">
              {data.totals.reserved}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Vendido</CardDescription>
            <CardTitle className="text-2xl text-blue-600">
              {data.totals.sold}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Disponible</CardDescription>
            <CardTitle className="text-2xl text-emerald-600">
              {data.totals.available}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Variantes</CardTitle>
          <CardDescription>
            {data.total === 0
              ? "No hay variantes que coincidan con el filtro."
              : `Mostrando ${data.items.length} de ${data.total} variante(s).`}
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
                    <TableHead>Estado</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Reservado</TableHead>
                    <TableHead>Vendido</TableHead>
                    <TableHead>Disponible</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((v: StockReportRow) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">
                        {v.product.name}
                        <p className="text-[10px] text-muted-foreground">
                          {v.product.category.name}
                        </p>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {v.code}
                      </TableCell>
                      <TableCell className="text-sm">
                        {v.color ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {v.size ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {VARIANT_STATUS_LABELS[v.status] ?? v.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {v.stock}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={v.reservedStock > 0 ? "secondary" : "outline"}
                          className={
                            v.reservedStock > 0
                              ? "bg-amber-500 text-white"
                              : ""
                          }
                        >
                          {v.reservedStock}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={v.soldStock > 0 ? "default" : "outline"}
                          className={
                            v.soldStock > 0 ? "bg-blue-600 text-white" : ""
                          }
                        >
                          {v.soldStock}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={v.available > 0 ? "default" : "destructive"}
                        >
                          {v.available}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/inventario/${v.id}`}
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
