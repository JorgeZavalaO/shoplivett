import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import {
  CreditStatus,
  LiveStatus,
  PaymentMethod,
  PaymentStatus,
} from "@prisma/client";

import { requireRole } from "@/lib/permissions";
import { PAYMENT_METHOD_LABELS } from "@/lib/settings-defaults";
import {
  getCreditsReportAction,
  getLivesReportAction,
  getPaymentsReportAction,
  getPendingBalancesReportAction,
  getReportSummaryAction,
  getStockReportAction,
  getTopProductsReportAction,
  listCategoryOptionsAction,
} from "@/actions/reports";
import {
  getBatchProfitabilityReportAction,
  getCustomersFinancialReportAction,
  getExpensesReportAction,
  getLowRotationReportAction,
  getProductProfitabilityReportAction,
  getReturnsLossesReportAction,
  getSalesByMonthReportAction,
  getStockValuationReportAction,
} from "@/actions/financial-reports";
import { ReportFilters } from "@/components/reports/report-filters";
import { SummaryCard } from "@/components/reports/summary-card";
import { PaymentsReportView } from "@/components/reports/payments-report-view";
import { PendingBalancesView } from "@/components/reports/pending-balances-view";
import { CreditsReportView } from "@/components/reports/credits-report-view";
import { LivesReportView } from "@/components/reports/lives-report-view";
import { StockReportView } from "@/components/reports/stock-report-view";
import { TopProductsView } from "@/components/reports/top-products-view";
import { SalesByMonthView } from "@/components/reports/sales-by-month-view";
import { ProductProfitabilityReportView } from "@/components/reports/product-profitability-report-view";
import { BatchProfitabilityReportView } from "@/components/reports/batch-profitability-report-view";
import { StockValuationReportView } from "@/components/reports/stock-valuation-report-view";
import { LowRotationReportView } from "@/components/reports/low-rotation-report-view";
import { FinancialExpensesView } from "@/components/reports/financial-expenses-view";
import { CustomersFinancialReportView } from "@/components/reports/customers-financial-report-view";
import { ReturnsLossesReportView } from "@/components/reports/returns-losses-report-view";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CREDIT_ORIGIN_VALUES,
  CREDIT_STATUS_VALUES,
  LIVE_STATUS_VALUES,
  PAYMENT_METHOD_VALUES,
  PAYMENT_STATUS_VALUES,
} from "@/lib/reports";
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CATEGORY_OPTIONS,
  EXPENSE_STATUS_VALUES,
  EXPENSE_TYPE_OPTIONS,
} from "@/lib/expenses-shared";
import {
  INCIDENT_DECISION_OPTIONS,
  INCIDENT_STATUS_VALUES,
  INCIDENT_TYPE_OPTIONS,
} from "@/lib/incidents-shared";
import { type IncidentStatus, type IncidentType, type IncidentReturnDecision } from "@prisma/client";
import type { ExpenseCategory, ExpenseStatus, ExpenseType } from "@prisma/client";

export const metadata: Metadata = { title: "Reportes" };

const SECTIONS = [
  { key: "summary", label: "Resumen" },
  { key: "payments", label: "Pagos" },
  { key: "pending", label: "Saldos pendientes" },
  { key: "credits", label: "Créditos" },
  { key: "lives", label: "Ventas por live" },
  { key: "stock", label: "Stock actual" },
  { key: "top", label: "Productos más vendidos" },
  { key: "fin-sales", label: "Ventas por mes" },
  { key: "fin-products", label: "Utilidad por producto" },
  { key: "fin-batches", label: "Rentabilidad por lote" },
  { key: "fin-stock", label: "Stock valorizado" },
  { key: "fin-rotation", label: "Sin rotación" },
  { key: "fin-expenses", label: "Gastos" },
  { key: "fin-customers", label: "Clientes" },
  { key: "fin-returns", label: "Devoluciones" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

const VALID_SECTIONS = SECTIONS.map((s) => s.key) as readonly SectionKey[];

function parseSection(value: string | undefined): SectionKey {
  if (value && (VALID_SECTIONS as readonly string[]).includes(value)) {
    return value as SectionKey;
  }
  return "summary";
}

function parsePaymentMethod(value: string | undefined): PaymentMethod | "ALL" {
  if (!value) return "ALL";
  if ((PAYMENT_METHOD_VALUES as readonly string[]).includes(value)) {
    return value as PaymentMethod;
  }
  return "ALL";
}

function parsePaymentStatus(value: string | undefined): PaymentStatus | "ALL" {
  if (!value) return "ALL";
  if ((PAYMENT_STATUS_VALUES as readonly string[]).includes(value)) {
    return value as PaymentStatus;
  }
  return "ALL";
}

function parseLiveStatus(value: string | undefined): LiveStatus | "ALL" {
  if (!value) return "ALL";
  if ((LIVE_STATUS_VALUES as readonly string[]).includes(value)) {
    return value as LiveStatus;
  }
  return "ALL";
}

function parseCreditStatus(value: string | undefined): CreditStatus | "ALL" {
  if (!value) return "ALL";
  if ((CREDIT_STATUS_VALUES as readonly string[]).includes(value)) {
    return value as CreditStatus;
  }
  return "ALL";
}

function parseCreditOrigin(
  value: string | undefined,
): (typeof CREDIT_ORIGIN_VALUES)[number] | "ALL" {
  if (!value) return "ALL";
  if ((CREDIT_ORIGIN_VALUES as readonly string[]).includes(value)) {
    return value as (typeof CREDIT_ORIGIN_VALUES)[number];
  }
  return "ALL";
}

function parseExpenseCategory(value: string | undefined): ExpenseCategory | "ALL" {
  if (!value) return "ALL";
  if (value in EXPENSE_CATEGORY_LABELS) return value as ExpenseCategory;
  return "ALL";
}

function parseExpenseType(value: string | undefined): ExpenseType | "ALL" {
  if (!value) return "ALL";
  if (value === "FIXED" || value === "VARIABLE") return value;
  return "ALL";
}

function parseExpenseStatus(value: string | undefined): ExpenseStatus | "ALL" {
  if (!value) return "ALL";
  if (value === "ACTIVE" || value === "VOIDED") return value;
  return "ALL";
}

function parseIncidentType(value: string | undefined): IncidentType | "ALL" {
  if (!value) return "ALL";
  if (INCIDENT_TYPE_OPTIONS.some((o) => o.value === value)) {
    return value as IncidentType;
  }
  return "ALL";
}

function parseIncidentStatus(value: string | undefined): IncidentStatus | "ALL" {
  if (!value) return "ALL";
  if (INCIDENT_STATUS_VALUES.some((s: IncidentStatus) => s === value)) {
    return value as IncidentStatus;
  }
  return "ALL";
}

function parseIncidentDecision(
  value: string | undefined,
): IncidentReturnDecision | "ALL" {
  if (!value) return "ALL";
  if (INCIDENT_DECISION_OPTIONS.some((d) => d.value === value)) {
    return value as IncidentReturnDecision;
  }
  return "ALL";
}

function parseInt32(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toDateInput(value: Date | null): string {
  if (!value) return "";
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const PAGE_SIZE = 20;

type SearchParams = Record<string, string | string[] | undefined>;

function first(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

function buildHref(current: SearchParams, patch: Record<string, string | null>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    if (v == null) continue;
    const value = Array.isArray(v) ? v[0] : v;
    if (value !== undefined && value !== "") params.set(k, value);
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === "") params.delete(k);
    else params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `/reportes?${qs}` : "/reportes";
}

function buildCsvHref(
  current: SearchParams,
  section: string,
  extra: Record<string, string | null> = {},
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    if (v == null) continue;
    const value = Array.isArray(v) ? v[0] : v;
    if (value !== undefined && value !== "") params.set(k, value);
  }
  params.delete("section");
  params.delete("page");
  for (const [k, v] of Object.entries(extra)) {
    if (v === null || v === "") params.delete(k);
    else params.set(k, v);
  }
  const qs = params.toString();
  return qs
    ? `/api/reportes/${section}?${qs}`
    : `/api/reportes/${section}`;
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole("ADMIN");
  const sp = await searchParams;

  const section = parseSection(first(sp, "section"));
  const fromInput = first(sp, "from") ?? "";
  const toInput = first(sp, "to") ?? "";
  const fromDate = parseDate(fromInput);
  const toDate = parseDate(toInput);
  const range = { from: fromDate, to: toDate };

  const summary = await getReportSummaryAction(range);

  if (section === "summary") {
    return (
      <ReportesShell section={section} sp={sp}>
        <SummarySection
          range={range}
          fromInput={fromInput}
          toInput={toInput}
          query=""
          summary={summary}
        />
      </ReportesShell>
    );
  }

  if (section === "payments") {
    const method = parsePaymentMethod(first(sp, "method"));
    const status = parsePaymentStatus(first(sp, "status"));
    const query = first(sp, "q") ?? "";
    const page = Math.max(1, Number(first(sp, "page") ?? "1") || 1);
    const data = await getPaymentsReportAction({
      ...range,
      method,
      status,
      query,
      page,
      perPage: PAGE_SIZE,
    });

    const extra = (
      <div className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="section" value="payments" />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="method" className="text-xs text-muted-foreground">
            Método
          </label>
          <select
            id="method"
            name="method"
            defaultValue={method}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            <option value="ALL">Todos</option>
            {PAYMENT_METHOD_VALUES.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="text-xs text-muted-foreground">
            Estado
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            <option value="ALL">Todos</option>
            {PAYMENT_STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
    );

    return (
      <ReportesShell section={section} sp={sp}>
        <ReportFilters
          from={fromInput}
          to={toInput}
          query={query}
          baseHref={buildHref(sp, { section: "payments" }) as Route}
          extra={extra}
          totalLabel="Pagos en el rango"
          totalValue={String(data.total)}
        />
        <PaymentsReportView data={data} />
        <PaginationLinks
          page={data.page}
          perPage={data.perPage}
          total={data.total}
          buildHref={(next) =>
            buildHref(sp, { section: "payments", page: next > 1 ? String(next) : null }) as Route
          }
        />
      </ReportesShell>
    );
  }

  if (section === "pending") {
    const query = first(sp, "q") ?? "";
    const page = Math.max(1, Number(first(sp, "page") ?? "1") || 1);
    const data = await getPendingBalancesReportAction({
      ...range,
      query,
      page,
      perPage: PAGE_SIZE,
    });

    return (
      <ReportesShell section={section} sp={sp}>
        <ReportFilters
          from={fromInput}
          to={toInput}
          query={query}
          baseHref={buildHref(sp, { section: "pending" }) as Route}
          totalLabel="Deuda activa total"
          totalValue={`S/ ${data.totalBalance}`}
        />
        <PendingBalancesView data={data} />
        <PaginationLinks
          page={data.page}
          perPage={data.perPage}
          total={data.total}
          buildHref={(next) =>
            buildHref(sp, { section: "pending", page: next > 1 ? String(next) : null }) as Route
          }
        />
      </ReportesShell>
    );
  }

  if (section === "credits") {
    const status = parseCreditStatus(first(sp, "status"));
    const origin = parseCreditOrigin(first(sp, "origin"));
    const query = first(sp, "q") ?? "";
    const page = Math.max(1, Number(first(sp, "page") ?? "1") || 1);
    const data = await getCreditsReportAction({
      ...range,
      status,
      origin,
      query,
      page,
      perPage: PAGE_SIZE,
    });

    const extra = (
      <div className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="section" value="credits" />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="text-xs text-muted-foreground">
            Estado
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            <option value="ALL">Todos</option>
            {CREDIT_STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="origin" className="text-xs text-muted-foreground">
            Origen
          </label>
          <select
            id="origin"
            name="origin"
            defaultValue={origin}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            <option value="ALL">Todos</option>
            {CREDIT_ORIGIN_VALUES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      </div>
    );

    return (
      <ReportesShell section={section} sp={sp}>
        <ReportFilters
          from={fromInput}
          to={toInput}
          query={query}
          baseHref={buildHref(sp, { section: "credits" }) as Route}
          extra={extra}
          totalLabel="Créditos en el rango"
          totalValue={String(data.total)}
        />
        <CreditsReportView data={data} />
        <PaginationLinks
          page={data.page}
          perPage={data.perPage}
          total={data.total}
          buildHref={(next) =>
            buildHref(sp, { section: "credits", page: next > 1 ? String(next) : null }) as Route
          }
        />
      </ReportesShell>
    );
  }

  if (section === "lives") {
    const status = parseLiveStatus(first(sp, "status"));
    const query = first(sp, "q") ?? "";
    const page = Math.max(1, Number(first(sp, "page") ?? "1") || 1);
    const data = await getLivesReportAction({
      ...range,
      status,
      query,
      page,
      perPage: PAGE_SIZE,
    });

    return (
      <ReportesShell section={section} sp={sp}>
        <ReportFilters
          from={fromInput}
          to={toInput}
          query={query}
          baseHref={buildHref(sp, { section: "lives" }) as Route}
          extra={
            <>
              <input type="hidden" name="section" value="lives" />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="status" className="text-xs text-muted-foreground">
                  Estado
                </label>
                <select
                  id="status"
                  name="status"
                  defaultValue={status}
                  className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                >
                  <option value="ALL">Todos</option>
                  {LIVE_STATUS_VALUES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </>
          }
          totalLabel="Lives en el rango"
          totalValue={String(data.total)}
        />
        <LivesReportView data={data} />
        <PaginationLinks
          page={data.page}
          perPage={data.perPage}
          total={data.total}
          buildHref={(next) =>
            buildHref(sp, { section: "lives", page: next > 1 ? String(next) : null }) as Route
          }
        />
      </ReportesShell>
    );
  }

  if (section === "stock") {
    const query = first(sp, "q") ?? "";
    const categoryId = first(sp, "categoryId") ?? "";
    const page = Math.max(1, Number(first(sp, "page") ?? "1") || 1);
    const [data, categories] = await Promise.all([
      getStockReportAction({
        query,
        categoryId: categoryId || undefined,
        page,
        perPage: PAGE_SIZE,
      }),
      listCategoryOptionsAction(),
    ]);

    return (
      <ReportesShell section={section} sp={sp}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtros</CardTitle>
            <CardDescription>
              Busca por nombre, código o color. Filtra por categoría para
              reportes más enfocados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              method="get"
              action={buildHref(sp, { section: "stock" }) as Route}
              className="flex flex-wrap items-end gap-3"
            >
              <input type="hidden" name="section" value="stock" />
              <div className="flex flex-1 flex-col gap-1.5 min-w-48">
                <label htmlFor="q" className="text-xs text-muted-foreground">
                  Buscar
                </label>
                <input
                  id="q"
                  name="q"
                  defaultValue={query}
                  placeholder="Nombre, código o color"
                  className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                />
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
                  defaultValue={categoryId}
                  className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                >
                  <option value="">Todas</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit" size="sm">
                  Aplicar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  render={
                    <a href={buildHref(sp, { section: "stock" }) as Route}>
                      Limpiar
                    </a>
                  }
                />
              </div>
            </form>
            <p className="mt-3 text-xs text-muted-foreground">
              Variantes en el filtro: <span className="font-medium">{data.total}</span>
            </p>
          </CardContent>
        </Card>
        <StockReportView data={data} />
        <PaginationLinks
          page={data.page}
          perPage={data.perPage}
          total={data.total}
          buildHref={(next) =>
            buildHref(sp, { section: "stock", page: next > 1 ? String(next) : null }) as Route
          }
        />
      </ReportesShell>
    );
  }

  if (section === "top") {
    const limit = Math.min(50, Math.max(1, Number(first(sp, "limit") ?? "20") || 20));
    const categoryId = first(sp, "categoryId") ?? "";
    const [data, categories] = await Promise.all([
      getTopProductsReportAction({
        ...range,
        limit,
        categoryId: categoryId || undefined,
      }),
      listCategoryOptionsAction(),
    ]);
    const hasRange = Boolean(fromDate || toDate);

    return (
      <ReportesShell section={section} sp={sp}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtros</CardTitle>
            <CardDescription>
              Selecciona un rango de fechas para medir unidades e ingresos en
              ese período. Sin rango, se muestra el acumulado histórico.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              method="get"
              action={buildHref(sp, { section: "top" }) as Route}
              className="flex flex-wrap items-end gap-3"
            >
              <input type="hidden" name="section" value="top" />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="from" className="text-xs text-muted-foreground">
                  Desde
                </label>
                <input
                  id="from"
                  name="from"
                  type="date"
                  defaultValue={fromInput}
                  className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="to" className="text-xs text-muted-foreground">
                  Hasta
                </label>
                <input
                  id="to"
                  name="to"
                  type="date"
                  defaultValue={toInput}
                  className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                />
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
                  defaultValue={categoryId}
                  className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                >
                  <option value="">Todas</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="limit" className="text-xs text-muted-foreground">
                  Top
                </label>
                <input
                  id="limit"
                  name="limit"
                  type="number"
                  min={1}
                  max={50}
                  defaultValue={limit}
                  className="h-8 w-20 rounded-lg border border-input bg-transparent px-2 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit" size="sm">
                  Aplicar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  render={
                    <a href={buildHref(sp, { section: "top" }) as Route}>
                      Limpiar
                    </a>
                  }
                />
              </div>
            </form>
          </CardContent>
        </Card>
        <TopProductsView data={data} hasRange={hasRange} />
      </ReportesShell>
    );
  }

  if (section === "fin-sales") {
    const data = await getSalesByMonthReportAction(range);
    return (
      <ReportesShell section={section} sp={sp}>
        <ReportFilters
          from={fromInput}
          to={toInput}
          query=""
          baseHref={buildHref(sp, { section: "fin-sales" }) as Route}
          totalLabel="Meses con ventas"
          totalValue={String(data.rows.length)}
        />
        <SalesByMonthView
          data={data}
          csvHref={buildCsvHref(sp, "sales")}
        />
      </ReportesShell>
    );
  }

  if (section === "fin-products") {
    const categoryId = first(sp, "categoryId") ?? "";
    const minUnits = parseInt32(first(sp, "minUnits"), 1);
    const [data, categories] = await Promise.all([
      getProductProfitabilityReportAction(range, {
        categoryId: categoryId || null,
        minUnits,
      }),
      listCategoryOptionsAction(),
    ]);
    const extra = (
      <div className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="section" value="fin-products" />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="categoryId" className="text-xs text-muted-foreground">
            Categoria
          </label>
          <select
            id="categoryId"
            name="categoryId"
            defaultValue={categoryId}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="minUnits" className="text-xs text-muted-foreground">
            Min. unidades
          </label>
          <input
            id="minUnits"
            name="minUnits"
            type="number"
            min={1}
            defaultValue={minUnits}
            className="h-8 w-20 rounded-lg border border-input bg-transparent px-2 text-sm"
          />
        </div>
      </div>
    );
    return (
      <ReportesShell section={section} sp={sp}>
        <ReportFilters
          from={fromInput}
          to={toInput}
          query=""
          baseHref={buildHref(sp, { section: "fin-products" }) as Route}
          extra={extra}
          totalLabel="Variantes en el reporte"
          totalValue={String(data.rows.length)}
        />
        <ProductProfitabilityReportView
          data={data}
          csvHref={buildCsvHref(sp, "products", {
            categoryId: categoryId || null,
            minUnits: String(minUnits),
          })}
        />
      </ReportesShell>
    );
  }

  if (section === "fin-batches") {
    const data = await getBatchProfitabilityReportAction(range);
    return (
      <ReportesShell section={section} sp={sp}>
        <ReportFilters
          from={fromInput}
          to={toInput}
          query=""
          baseHref={buildHref(sp, { section: "fin-batches" }) as Route}
          totalLabel="Lotes con ventas"
          totalValue={String(data.rows.length)}
        />
        <BatchProfitabilityReportView
          data={data}
          csvHref={buildCsvHref(sp, "batches")}
        />
      </ReportesShell>
    );
  }

  if (section === "fin-stock") {
    const categoryId = first(sp, "categoryId") ?? "";
    const query = first(sp, "q") ?? "";
    const [data, categories] = await Promise.all([
      getStockValuationReportAction({
        categoryId: categoryId || null,
        query: query || undefined,
      }),
      listCategoryOptionsAction(),
    ]);
    return (
      <ReportesShell section={section} sp={sp}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtros</CardTitle>
            <CardDescription>
              Busca por nombre, codigo o color. Filtra por categoria para
              reportes mas enfocados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              method="get"
              action={buildHref(sp, { section: "fin-stock" }) as Route}
              className="flex flex-wrap items-end gap-3"
            >
              <input type="hidden" name="section" value="fin-stock" />
              <div className="flex flex-1 flex-col gap-1.5 min-w-48">
                <label htmlFor="q" className="text-xs text-muted-foreground">
                  Buscar
                </label>
                <input
                  id="q"
                  name="q"
                  defaultValue={query}
                  placeholder="Nombre, codigo o color"
                  className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="categoryId"
                  className="text-xs text-muted-foreground"
                >
                  Categoria
                </label>
                <select
                  id="categoryId"
                  name="categoryId"
                  defaultValue={categoryId}
                  className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                >
                  <option value="">Todas</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit" size="sm">
                  Aplicar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  render={
                    <a href={buildHref(sp, { section: "fin-stock" }) as Route}>
                      Limpiar
                    </a>
                  }
                />
              </div>
            </form>
            <p className="mt-3 text-xs text-muted-foreground">
              Variantes valorizadas: <span className="font-medium">{data.rows.length}</span>
            </p>
          </CardContent>
        </Card>
        <StockValuationReportView
          data={data}
          csvHref={buildCsvHref(sp, "stock", {
            categoryId: categoryId || null,
            q: query || null,
          })}
        />
      </ReportesShell>
    );
  }

  if (section === "fin-rotation") {
    const days = parseInt32(first(sp, "days"), 60);
    const categoryId = first(sp, "categoryId") ?? "";
    const [data, categories] = await Promise.all([
      getLowRotationReportAction({
        days,
        categoryId: categoryId || null,
      }),
      listCategoryOptionsAction(),
    ]);
    return (
      <ReportesShell section={section} sp={sp}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtros</CardTitle>
            <CardDescription>
              Define el umbral en dias para considerar una variante como sin
              rotacion.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              method="get"
              action={buildHref(sp, { section: "fin-rotation" }) as Route}
              className="flex flex-wrap items-end gap-3"
            >
              <input type="hidden" name="section" value="fin-rotation" />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="days" className="text-xs text-muted-foreground">
                  Umbral (dias)
                </label>
                <input
                  id="days"
                  name="days"
                  type="number"
                  min={1}
                  max={365}
                  defaultValue={days}
                  className="h-8 w-24 rounded-lg border border-input bg-transparent px-2 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="categoryId"
                  className="text-xs text-muted-foreground"
                >
                  Categoria
                </label>
                <select
                  id="categoryId"
                  name="categoryId"
                  defaultValue={categoryId}
                  className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                >
                  <option value="">Todas</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit" size="sm">
                  Aplicar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  render={
                    <a
                      href={buildHref(sp, { section: "fin-rotation" }) as Route}
                    >
                      Limpiar
                    </a>
                  }
                />
              </div>
            </form>
          </CardContent>
        </Card>
        <LowRotationReportView
          data={data}
          csvHref={buildCsvHref(sp, "rotation", {
            days: String(days),
            categoryId: categoryId || null,
          })}
        />
      </ReportesShell>
    );
  }

  if (section === "fin-expenses") {
    const year = parseInt32(first(sp, "year"), new Date().getFullYear());
    const month = parseInt32(first(sp, "month"), new Date().getMonth() + 1);
    const safeMonth = Math.min(12, Math.max(1, month));
    const safeYear = Math.max(2000, Math.min(2100, year));
    const category = parseExpenseCategory(first(sp, "category"));
    const type = parseExpenseType(first(sp, "type"));
    const status = parseExpenseStatus(first(sp, "status"));
    const query = first(sp, "q") ?? "";
    const data = await getExpensesReportAction({
      year: safeYear,
      month: safeMonth,
      category,
      type,
      status,
      query: query || undefined,
      page: 1,
      perPage: 1000,
    });
    const extra = (
      <div className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="section" value="fin-expenses" />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="year" className="text-xs text-muted-foreground">
            Año
          </label>
          <input
            id="year"
            name="year"
            type="number"
            min={2000}
            max={2100}
            defaultValue={safeYear}
            className="h-8 w-24 rounded-lg border border-input bg-transparent px-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="month" className="text-xs text-muted-foreground">
            Mes
          </label>
          <select
            id="month"
            name="month"
            defaultValue={String(safeMonth)}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="category" className="text-xs text-muted-foreground">
            Categoria
          </label>
          <select
            id="category"
            name="category"
            defaultValue={category}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            <option value="ALL">Todas</option>
            {EXPENSE_CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="type" className="text-xs text-muted-foreground">
            Tipo
          </label>
          <select
            id="type"
            name="type"
            defaultValue={type}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            <option value="ALL">Todos</option>
            {EXPENSE_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="text-xs text-muted-foreground">
            Estado
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            <option value="ALL">Todos</option>
            {EXPENSE_STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="q" className="text-xs text-muted-foreground">
            Buscar
          </label>
          <input
            id="q"
            name="q"
            defaultValue={query}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
          />
        </div>
      </div>
    );
    return (
      <ReportesShell section={section} sp={sp}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtros</CardTitle>
            <CardDescription>
              Gastos operativos con categoria, tipo, estado y busqueda libre.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              method="get"
              action={buildHref(sp, { section: "fin-expenses" }) as Route}
              className="flex flex-wrap items-end gap-3"
            >
              {extra}
              <div className="flex items-center gap-2">
                <Button type="submit" size="sm">
                  Aplicar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  render={
                    <a
                      href={buildHref(sp, { section: "fin-expenses" }) as Route}
                    >
                      Limpiar
                    </a>
                  }
                />
              </div>
            </form>
          </CardContent>
        </Card>
        <FinancialExpensesView
          data={data}
          csvHref={buildCsvHref(sp, "expenses", {
            year: String(safeYear),
            month: String(safeMonth),
            category: category === "ALL" ? null : category,
            type: type === "ALL" ? null : type,
            status: status === "ALL" ? null : status,
            q: query || null,
          })}
        />
      </ReportesShell>
    );
  }

  if (section === "fin-customers") {
    const query = first(sp, "q") ?? "";
    const data = await getCustomersFinancialReportAction(range, {
      query: query || undefined,
    });
    return (
      <ReportesShell section={section} sp={sp}>
        <ReportFilters
          from={fromInput}
          to={toInput}
          query={query}
          baseHref={buildHref(sp, { section: "fin-customers" }) as Route}
          totalLabel="Clientes en el reporte"
          totalValue={String(data.rows.length)}
        />
        <CustomersFinancialReportView
          data={data}
          csvHref={buildCsvHref(sp, "customers", { q: query || null })}
        />
      </ReportesShell>
    );
  }

  if (section === "fin-returns") {
    const type = parseIncidentType(first(sp, "type"));
    const status = parseIncidentStatus(first(sp, "status"));
    const decision = parseIncidentDecision(first(sp, "decision"));
    const data = await getReturnsLossesReportAction(range, {
      type,
      status,
      decision,
    });
    const extra = (
      <div className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="section" value="fin-returns" />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="type" className="text-xs text-muted-foreground">
            Tipo
          </label>
          <select
            id="type"
            name="type"
            defaultValue={type}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            <option value="ALL">Todos</option>
            {INCIDENT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="text-xs text-muted-foreground">
            Estado
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            <option value="ALL">Todos</option>
            {INCIDENT_STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="decision" className="text-xs text-muted-foreground">
            Decision
          </label>
          <select
            id="decision"
            name="decision"
            defaultValue={decision}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            <option value="ALL">Todas</option>
            {INCIDENT_DECISION_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
    return (
      <ReportesShell section={section} sp={sp}>
        <ReportFilters
          from={fromInput}
          to={toInput}
          query=""
          baseHref={buildHref(sp, { section: "fin-returns" }) as Route}
          extra={extra}
          totalLabel="Incidencias en el reporte"
          totalValue={String(data.rows.length)}
        />
        <ReturnsLossesReportView
          data={data}
          csvHref={buildCsvHref(sp, "returns", {
            type: type === "ALL" ? null : type,
            status: status === "ALL" ? null : status,
            decision: decision === "ALL" ? null : decision,
          })}
        />
      </ReportesShell>
    );
  }

  redirect("/reportes");
}

function ReportesShell({
  section,
  sp,
  children,
}: {
  section: SectionKey;
  sp: SearchParams;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>
        <p className="text-sm text-muted-foreground">
          Módulo de reportes operativos. Los totales financieros se basan en
          pagos validados y pedidos reales.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2">
        {SECTIONS.map((s) => {
          const isActive = s.key === section;
          return (
            <Button
              key={s.key}
              size="sm"
              variant={isActive ? "default" : "outline"}
              render={
                <a href={buildHref(sp, { section: s.key }) as Route}>
                  {s.label}
                </a>
              }
            />
          );
        })}
      </nav>

      {children}
    </div>
  );
}

async function SummarySection({
  range,
  fromInput,
  toInput,
  query,
  summary,
}: {
  range: { from: Date | null; to: Date | null };
  fromInput: string;
  toInput: string;
  query: string;
  summary: Awaited<ReturnType<typeof getReportSummaryAction>>;
}) {
  return (
    <div className="flex flex-col gap-4">
      <ReportFilters
        from={fromInput}
        to={toInput}
        query={query}
        baseHref={"/reportes" as Route}
        totalLabel="Rango seleccionado"
        totalValue={
          range.from || range.to
            ? `${toDateInput(range.from)} → ${toDateInput(range.to)}`
            : "Todo el historial"
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Pedidos creados"
          value={`S/ ${summary.ventas}`}
          hint={`${summary.pedidosCount} pedido(s) en el rango`}
        />
        <SummaryCard
          title="Cobros validados"
          value={`S/ ${summary.cobrosValidados}`}
          hint={`${summary.pagosCount} pago(s) validados`}
          tone="success"
        />
        <SummaryCard
          title="Deuda activa"
          value={`S/ ${summary.deudaActiva}`}
          hint="Saldos pendientes de pedidos activos"
          tone="warning"
        />
        <SummaryCard
          title="Créditos disponibles"
          value={`S/ ${summary.creditoDisponible}`}
          hint="AVAILABLE + PARTIALLY_USED"
          tone="success"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notas</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <b>Pedidos creados</b> usa <code>Order.createdAt</code> y considera
              todos los estados.
            </li>
            <li>
              <b>Cobros validados</b> usa <code>Payment.validatedAt</code> y
              sólo pagos <code>VALIDATED</code> (cumple RNF-S13-01).
            </li>
            <li>
              <b>Deuda activa</b> suma <code>Order.balance</code> en estados
              <code> PAYMENT_VALIDATION_PENDING / RESERVED / PARTIALLY_PAID</code>.
            </li>
            <li>
              <b>Créditos disponibles</b> usa
              <code> CustomerCredit.availableAmount</code> en
              <code> AVAILABLE / PARTIALLY_USED</code>.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function PaginationLinks({
  page,
  perPage,
  total,
  buildHref,
}: {
  page: number;
  perPage: number;
  total: number;
  buildHref: (page: number) => Route;
}) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  if (total <= perPage) return null;
  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <span>
        Página {page} de {totalPages}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button size="xs" variant="outline" render={<a href={buildHref(page - 1)}>Anterior</a>} />
        ) : null}
        {page < totalPages ? (
          <Button size="xs" variant="outline" render={<a href={buildHref(page + 1)}>Siguiente</a>} />
        ) : null}
      </div>
    </div>
  );
}
