import type { Route } from "next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type DateFilterProps = {
  from: string;
  to: string;
  query: string;
  baseHref: Route;
  extra?: React.ReactNode;
  totalLabel?: string;
  totalValue?: string;
};

export function ReportFilters({
  from,
  to,
  query,
  baseHref,
  extra,
  totalLabel,
  totalValue,
}: DateFilterProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Filtros</CardTitle>
        <CardDescription>
          Aplica fechas y búsqueda para acotar el reporte. Los totales
          financieros se basan en pagos validados.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          method="get"
          action={baseHref}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="from" className="text-xs text-muted-foreground">
              Desde
            </label>
            <Input
              id="from"
              name="from"
              type="date"
              defaultValue={from}
              className="w-40"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="to" className="text-xs text-muted-foreground">
              Hasta
            </label>
            <Input
              id="to"
              name="to"
              type="date"
              defaultValue={to}
              className="w-40"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5 min-w-48">
            <label htmlFor="q" className="text-xs text-muted-foreground">
              Buscar
            </label>
            <Input
              id="q"
              name="q"
              defaultValue={query}
              placeholder="Nombre, número de pedido, operación…"
            />
          </div>
          {extra}
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm">
              Aplicar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              render={<a href={baseHref}>Limpiar</a>}
            />
          </div>
        </form>
        {totalLabel ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {totalLabel}: <span className="font-medium">{totalValue}</span>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
