import type { Route } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import type { FilterOption } from "@/lib/financial-dashboard";

export type FinancialFilterValues = {
  year: string;
  month: string;
  salesChannel: string;
  batchId: string;
  categoryId: string;
};

type Props = {
  values: FinancialFilterValues;
  baseHref: Route;
  yearOptions: Array<{ value: string; label: string }>;
  monthOptions: Array<{ value: string; label: string }>;
  channelOptions: FilterOption[];
  batchOptions: FilterOption[];
  categoryOptions: FilterOption[];
};

export function FinancialFilters({
  values,
  baseHref,
  yearOptions,
  monthOptions,
  channelOptions,
  batchOptions,
  categoryOptions,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Filtros financieros</CardTitle>
        <CardDescription>
          Acota el periodo y los datos del dashboard. Los totales se calculan
          a partir de pedidos PAID y costos congelados.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          method="get"
          action={baseHref}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="year" className="text-xs text-muted-foreground">
              Año
            </label>
            <select
              id="year"
              name="year"
              defaultValue={values.year}
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
            >
              {yearOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="month" className="text-xs text-muted-foreground">
              Mes
            </label>
            <select
              id="month"
              name="month"
              defaultValue={values.month}
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
            >
              {monthOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="salesChannel"
              className="text-xs text-muted-foreground"
            >
              Canal
            </label>
            <select
              id="salesChannel"
              name="salesChannel"
              defaultValue={values.salesChannel}
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
            >
              {channelOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="batchId" className="text-xs text-muted-foreground">
              Lote
            </label>
            <select
              id="batchId"
              name="batchId"
              defaultValue={values.batchId}
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
            >
              {batchOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="categoryId"
              className="text-xs text-muted-foreground"
            >
              Categoría
            </label>
            <select
              id="categoryId"
              name="categoryId"
              defaultValue={values.categoryId}
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
            >
              {categoryOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="inline-flex h-8 items-center justify-center rounded-lg border border-transparent bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80"
            >
              Aplicar
            </button>
            <a
              href={baseHref}
              className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm hover:bg-muted"
            >
              Limpiar
            </a>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

void Input;
