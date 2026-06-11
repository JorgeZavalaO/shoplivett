import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Boxes, Lock, PackageCheck, Wallet } from "lucide-react";

import type { StockSummary } from "@/lib/inventory";

type Props = {
  summary: StockSummary;
};

export function StockSummaryCards({ summary }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader>
          <CardDescription>Stock total</CardDescription>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Boxes className="size-5 text-muted-foreground" />
            {summary.stock}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Unidades físicas registradas.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Reservado</CardDescription>
          <CardTitle className="flex items-center gap-2 text-2xl text-amber-600">
            <Lock className="size-5" />
            {summary.reservedStock}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Separaciones activas pendientes de pago.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Vendido</CardDescription>
          <CardTitle className="flex items-center gap-2 text-2xl text-emerald-600">
            <PackageCheck className="size-5" />
            {summary.soldStock}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Pagos confirmados.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Disponible</CardDescription>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Wallet className="size-5 text-muted-foreground" />
            {summary.available}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Stock listo para vender.
        </CardContent>
      </Card>
    </div>
  );
}
