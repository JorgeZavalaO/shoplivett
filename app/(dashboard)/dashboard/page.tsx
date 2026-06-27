import type { Route } from "next";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardMetricCard } from "@/components/dashboard/dashboard-metric-card";

export const metadata: Metadata = { title: "Dashboard" };
import {
  DashboardQuickList,
  type DashboardQuickItem,
} from "@/components/dashboard/dashboard-quick-list";
import {
  FinancialFilters,
  type FinancialFilterValues,
} from "@/components/dashboard/financial-filters";
import {
  BatchProfitabilitySection,
  FinancialOverviewCards,
  OpenBatchCapitalCards,
  ProductProfitabilitySection,
  StockValuationByCategory,
  StockValuationCards,
} from "@/components/dashboard/financial-overview-cards";
import {
  FinancialAlertsList,
  LowRotationSection,
} from "@/components/dashboard/financial-alerts";
import { canManageShipments, canValidatePayments, requireUser } from "@/lib/permissions";
import { getDashboardMetrics } from "@/lib/dashboard";
import { SHIPPING_METHOD_LABELS } from "@/lib/settings-defaults";
import { PAYMENT_METHOD_LABELS } from "@/lib/settings-defaults";
import type { Role } from "@/lib/permissions";
import {
  getBatchProfitability,
  getFinancialAlerts,
  getFinancialOverview,
  getLowRotationProducts,
  getOpenBatchCapital,
  getProductProfitability,
  getStockValuation,
  listBatchOptions,
  listCategoryOptionsForFilter,
  safeAllString,
  safeSalesChannel,
  safeYearMonth,
  SALES_CHANNEL_FILTER_OPTIONS,
  type FinancialDashboardFilter,
} from "@/lib/financial-dashboard";
import {
  DEFAULT_BATCH_PROFITABILITY_LIMIT,
  DEFAULT_LOW_ROTATION_LIMIT,
  DEFAULT_TOP_PRODUCTS_LIMIT,
  LOW_ROTATION_THRESHOLD_DAYS,
} from "@/lib/financial-dashboard-shared";
import { SALES_CHANNEL_LABELS } from "@/lib/settings-defaults";


const DATE_FORMATTER = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function fmtMoney(value: string): string {
  return `S/ ${value}`;
}

function fmtDate(value: Date): string {
  return DATE_FORMATTER.format(value);
}

const ROUTES = {
  paymentsPending: "/pagos?status=PENDING" as Route,
  paymentsAll: "/pagos" as Route,
  ordersExpired: "/pedidos/vencidos" as Route,
  ordersAll: "/pedidos" as Route,
  ordersReserved: "/pedidos?status=RESERVED" as Route,
  ordersPartially: "/pedidos?status=PARTIALLY_PAID" as Route,
  ordersValidation: "/pedidos?status=PAYMENT_VALIDATION_PENDING" as Route,
  ordersPaid: "/pedidos" as Route,
  customersAll: "/clientes" as Route,
  shipmentsPreparing: "/envios?status=PREPARING" as Route,
  shipmentsReady: "/envios?status=READY" as Route,
  shipmentsShipped: "/envios?status=SHIPPED" as Route,
  shipmentsPending: "/envios?status=PENDING" as Route,
  shipmentsNew: "/envios/nuevo" as Route,
  liveOpen: "/lives" as Route,
  sales: "/ventas" as Route,
  lotsAll: "/lotes" as Route,
  expensesAll: "/gastos" as Route,
  incidentsAll: "/incidencias" as Route,
  inventoryAll: "/inventario" as Route,
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

const MONTH_LABELS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function yearOptions(currentYear: number): Array<{ value: string; label: string }> {
  const out: Array<{ value: string; label: string }> = [];
  for (let y = currentYear - 3; y <= currentYear + 1; y += 1) {
    out.push({ value: String(y), label: String(y) });
  }
  return out;
}

function monthOptions(): Array<{ value: string; label: string }> {
  return MONTH_LABELS.map((label, idx) => ({
    value: String(idx + 1),
    label,
  }));
}

function channelOptionsWithLabels(): Array<{ value: string; label: string }> {
  return SALES_CHANNEL_FILTER_OPTIONS.map((o) => {
    if (o.value === "ALL") return o;
    const label = SALES_CHANNEL_LABELS[o.value as keyof typeof SALES_CHANNEL_LABELS] ?? o.label;
    return { value: o.value, label };
  });
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const now = new Date();
  const currentYear = now.getFullYear();
  const { year, month } = safeYearMonth(
    first(sp, "year"),
    first(sp, "month"),
  );
  const salesChannel = safeSalesChannel(first(sp, "salesChannel"));
  const batchId = safeAllString(first(sp, "batchId"));
  const categoryId = safeAllString(first(sp, "categoryId"));

  const filter: FinancialDashboardFilter = {
    year,
    month,
    salesChannel,
    batchId,
    categoryId,
  };

  const metrics = await getDashboardMetrics();
  const canValidate = await canValidatePayments(user.role);
  const canManageShipment = canManageShipments(user.role);
  const role = user.role as Role;

  const filterValues: FinancialFilterValues = {
    year: String(year),
    month: String(month),
    salesChannel,
    batchId,
    categoryId,
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Hola, {user.name?.trim() || user.email || "usuario"}
          </h1>
          <Badge>{role}</Badge>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Resumen operativo del día. Los números vienen directamente de
          pedidos, pagos, créditos y envíos en curso.
        </p>
      </div>

      {role === "ADMIN" ? (
        <AdminDashboard
          metrics={metrics}
          canValidate={canValidate}
          canManageShipment={canManageShipment}
          filter={filter}
          filterValues={filterValues}
          yearOptions={yearOptions(currentYear)}
        />
      ) : role === "SELLER" ? (
        <SellerDashboard
          metrics={metrics}
          canValidate={canValidate}
        />
      ) : (
        <DispatchDashboard
          metrics={metrics}
          canManageShipment={canManageShipment}
        />
      )}
    </div>
  );
}

function AdminDashboard({
  metrics,
  canValidate,
  canManageShipment,
  filter,
  filterValues,
  yearOptions,
}: {
  metrics: Awaited<ReturnType<typeof getDashboardMetrics>>;
  canValidate: boolean;
  canManageShipment: boolean;
  filter: FinancialDashboardFilter;
  filterValues: FinancialFilterValues;
  yearOptions: Array<{ value: string; label: string }>;
}) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <DashboardMetricCard
          title="Ventas del día"
          value={fmtMoney(metrics.ventasDelDia)}
          hint={`${metrics.pedidosDelDiaCount} pedido(s) creados hoy`}
          href={ROUTES.ordersAll}
        />
        <DashboardMetricCard
          title="Pagos validados del día"
          value={fmtMoney(metrics.pagosValidadosDelDia)}
          hint="Pagos confirmados hoy"
          href={ROUTES.paymentsAll}
        />
        <DashboardMetricCard
          title="Pagos por validar"
          value={String(metrics.pagosPendientesCount)}
          tone="warning"
          hint="Pendientes de revisión manual"
          href={ROUTES.paymentsPending}
        />
        <DashboardMetricCard
          title="Reservas vencidas"
          value={String(metrics.reservasVencidasCount)}
          tone={metrics.reservasVencidasCount > 0 ? "destructive" : "default"}
          hint="Pedidos que requieren cancelación"
          href={ROUTES.ordersExpired}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <DashboardMetricCard
          title="Reservas por vencer (48h)"
          value={String(metrics.reservasPorVencerCount)}
          tone={metrics.reservasPorVencerCount > 0 ? "warning" : "default"}
          hint="Pedidos cuya reserva vence pronto"
          href={ROUTES.ordersAll}
        />
        <DashboardMetricCard
          title="Deuda acumulada"
          value={fmtMoney(metrics.deudaAcumulada)}
          hint="Suma de saldos pendientes"
          href={ROUTES.ordersPartially}
        />
        <DashboardMetricCard
          title="Créditos disponibles"
          value={fmtMoney(metrics.creditosDisponibles)}
          tone="success"
          hint="Por sobrepago, manuales o devoluciones"
          href={ROUTES.customersAll}
        />
        <DashboardMetricCard
          title="Pedidos listos para despacho"
          value={String(metrics.pedidosListosDespachoCount)}
          tone="success"
          hint="Pagados sin envío asignado"
          href={canManageShipment ? ROUTES.shipmentsPending : ROUTES.ordersPaid}
        />
      </div>

      <AdminFinancialSection
        filter={filter}
        filterValues={filterValues}
        yearOptions={yearOptions}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <DashboardQuickList
          title="Pagos pendientes"
          description="Los más antiguos esperando validación."
          emptyLabel="No hay pagos pendientes."
          items={metrics.pendingPayments.map<DashboardQuickItem>((p) => ({
            id: p.id,
            title: p.customer.name,
            subtitle: `${PAYMENT_METHOD_LABELS[p.method]} · ${fmtMoney(p.amount)}`,
            badge: { kind: "payment", status: "PENDING" },
            meta: fmtDate(p.createdAt),
            href: `/pagos/${p.id}` as Route,
            whatsapp: { name: p.customer.name, phone: p.customer.whatsapp },
          }))}
          viewAllHref={ROUTES.paymentsPending}
          viewAllLabel="Ver todos los pagos pendientes"
        />
        <DashboardQuickList
          title="Reservas por vencer"
          description="Vencen en los próximos 2 días."
          emptyLabel="No hay reservas por vencer."
          items={metrics.reservationsNearExpiry.map<DashboardQuickItem>((o) => ({
            id: o.id,
            title: o.customer.name,
            subtitle: `${o.orderNumber} · saldo ${fmtMoney(o.balance)}`,
            badge: { kind: "order", status: "RESERVED" },
            meta: `vence ${fmtDate(o.expiresAt)}`,
            href: `/pedidos/${o.id}` as Route,
            whatsapp: { name: o.customer.name, phone: o.customer.whatsapp },
          }))}
          viewAllHref={ROUTES.ordersAll}
          viewAllLabel="Ver todos los pedidos"
        />
        <DashboardQuickList
          title="Pedidos listos para envío"
          description="Pagados sin envío asignado."
          emptyLabel="No hay pedidos listos para envío."
          items={metrics.ordersReadyForShipment.map<DashboardQuickItem>((o) => ({
            id: o.id,
            title: o.customer.name,
            subtitle: `${o.orderNumber} · ${fmtMoney(o.total)}`,
            badge: { kind: "order", status: "PAID" },
            meta: fmtDate(o.createdAt),
            href: `/pedidos/${o.id}` as Route,
            whatsapp: { name: o.customer.name, phone: o.customer.whatsapp },
          }))}
          viewAllHref={canManageShipment ? ROUTES.shipmentsPending : ROUTES.ordersPaid}
          viewAllLabel="Ver pedidos pagados"
        />
      </div>

      <AccessSection canValidate={canValidate} canManageShipment={canManageShipment} />
    </>
  );
}

async function AdminFinancialSection({
  filter,
  filterValues,
  yearOptions,
}: {
  filter: FinancialDashboardFilter;
  filterValues: FinancialFilterValues;
  yearOptions: Array<{ value: string; label: string }>;
}) {
  const [
    overview,
    stockValuation,
    openBatchCapital,
    topProducts,
    lowProducts,
    lowRotation,
    alerts,
    batchProfitability,
    batchOptions,
    categoryOptions,
  ] = await Promise.all([
    getFinancialOverview(filter),
    getStockValuation(),
    getOpenBatchCapital(),
    getProductProfitability({
      year: filter.year,
      month: filter.month,
      salesChannel: filter.salesChannel,
      categoryId: filter.categoryId,
      order: "TOP",
      limit: DEFAULT_TOP_PRODUCTS_LIMIT,
    }),
    getProductProfitability({
      year: filter.year,
      month: filter.month,
      salesChannel: filter.salesChannel,
      categoryId: filter.categoryId,
      order: "BOTTOM",
      limit: DEFAULT_TOP_PRODUCTS_LIMIT,
    }),
    getLowRotationProducts(LOW_ROTATION_THRESHOLD_DAYS, DEFAULT_LOW_ROTATION_LIMIT),
    getFinancialAlerts(filter),
    getBatchProfitability({
      year: filter.year,
      month: filter.month,
      limit: DEFAULT_BATCH_PROFITABILITY_LIMIT,
    }),
    listBatchOptions(),
    listCategoryOptionsForFilter(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <FinancialFilters
        values={filterValues}
        baseHref={"/dashboard" as Route}
        yearOptions={yearOptions}
        monthOptions={monthOptions()}
        channelOptions={channelOptionsWithLabels()}
        batchOptions={batchOptions}
        categoryOptions={categoryOptions}
      />

      <FinancialOverviewCards overview={overview} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <DashboardMetricCard
          title="Ventas del mes (filtro)"
          value={fmtMoney(overview.revenue)}
          hint={`${overview.ordersCount} pedido(s) PAID`}
          href={ROUTES.ordersPaid}
        />
        <DashboardMetricCard
          title="Margen real del mes"
          value={`${(overview.marginBps / 100).toFixed(1)}%`}
          tone={overview.marginBps < 0 ? "destructive" : "default"}
          hint="Utilidad neta real / ventas"
        />
        <DashboardMetricCard
          title="Costo de empaque aplicado"
          value={fmtMoney(overview.packagingCost)}
          hint="Configuracion del negocio"
        />
      </div>

      <FinancialAlertsList alerts={alerts} />

      <div className="grid gap-4 md:grid-cols-2">
        <StockValuationCards valuation={stockValuation} />
      </div>

      <StockValuationByCategory valuation={stockValuation} />

      <OpenBatchCapitalCards capital={openBatchCapital} />

      <BatchProfitabilitySection rows={batchProfitability.rows} />

      <div className="grid gap-4 md:grid-cols-2">
        <ProductProfitabilitySection
          title="Top productos rentables"
          description="Mayor utilidad bruta en el periodo seleccionado."
          rows={topProducts.rows}
          viewAllHref={ROUTES.lotsAll}
          viewAllLabel="Ver reportes"
        />
        <ProductProfitabilitySection
          title="Productos con menor margen"
          description="Variantes con menor utilidad bruta en el periodo."
          rows={lowProducts.rows}
          viewAllHref={ROUTES.lotsAll}
          viewAllLabel="Ver reportes"
        />
      </div>

      <LowRotationSection rows={lowRotation.rows} />

      <p className="text-xs text-muted-foreground">
        Aplican los filtros: año {filter.year}, mes {filter.month}, canal{" "}
        {filter.salesChannel}, lote {filter.batchId}, categoría{" "}
        {filter.categoryId}. Usa el boton Limpiar para reiniciar.
      </p>
    </div>
  );
}

function SellerDashboard({
  metrics,
  canValidate,
}: {
  metrics: Awaited<ReturnType<typeof getDashboardMetrics>>;
  canValidate: boolean;
}) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <DashboardMetricCard
          title="Ventas del día"
          value={fmtMoney(metrics.ventasDelDia)}
          hint={`${metrics.pedidosDelDiaCount} pedido(s) creados hoy`}
          href={ROUTES.ordersAll}
        />
        <DashboardMetricCard
          title="Pagos por validar"
          value={String(metrics.pagosPendientesCount)}
          tone="warning"
          hint="Pendientes de revisión manual"
          href={ROUTES.paymentsPending}
        />
        <DashboardMetricCard
          title="Reservas por vencer (48h)"
          value={String(metrics.reservasPorVencerCount)}
          tone={metrics.reservasPorVencerCount > 0 ? "warning" : "default"}
          hint="Pedidos cuya reserva vence pronto"
          href={ROUTES.ordersAll}
        />
        <DashboardMetricCard
          title="Reservas vencidas"
          value={String(metrics.reservasVencidasCount)}
          tone={metrics.reservasVencidasCount > 0 ? "destructive" : "default"}
          hint="Requieren cancelación"
          href={ROUTES.ordersExpired}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <DashboardMetricCard
          title="Deuda acumulada"
          value={fmtMoney(metrics.deudaAcumulada)}
          hint="Suma de saldos pendientes"
          href={ROUTES.ordersPartially}
        />
        <DashboardMetricCard
          title="Créditos disponibles"
          value={fmtMoney(metrics.creditosDisponibles)}
          tone="success"
          hint="Por sobrepago, manuales o devoluciones"
          href={ROUTES.customersAll}
        />
        <DashboardMetricCard
          title="Pedidos del día"
          value={String(metrics.pedidosDelDiaCount)}
          hint="Pedidos creados hoy"
          href={ROUTES.ordersAll}
        />
        <DashboardMetricCard
          title="Pagos validados del día"
          value={fmtMoney(metrics.pagosValidadosDelDia)}
          hint="Pagos confirmados hoy"
          href={ROUTES.paymentsAll}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <DashboardQuickList
          title="Pagos pendientes"
          description="Los más antiguos esperando validación."
          emptyLabel="No hay pagos pendientes."
          items={metrics.pendingPayments.map<DashboardQuickItem>((p) => ({
            id: p.id,
            title: p.customer.name,
            subtitle: `${PAYMENT_METHOD_LABELS[p.method]} · ${fmtMoney(p.amount)}`,
            badge: { kind: "payment", status: "PENDING" },
            meta: fmtDate(p.createdAt),
            href: `/pagos/${p.id}` as Route,
            whatsapp: { name: p.customer.name, phone: p.customer.whatsapp },
          }))}
          viewAllHref={ROUTES.paymentsPending}
          viewAllLabel="Ver todos los pagos pendientes"
        />
        <DashboardQuickList
          title="Reservas por vencer"
          description="Vencen en los próximos 2 días."
          emptyLabel="No hay reservas por vencer."
          items={metrics.reservationsNearExpiry.map<DashboardQuickItem>((o) => ({
            id: o.id,
            title: o.customer.name,
            subtitle: `${o.orderNumber} · saldo ${fmtMoney(o.balance)}`,
            badge: { kind: "order", status: "RESERVED" },
            meta: `vence ${fmtDate(o.expiresAt)}`,
            href: `/pedidos/${o.id}` as Route,
            whatsapp: { name: o.customer.name, phone: o.customer.whatsapp },
          }))}
          viewAllHref={ROUTES.ordersAll}
          viewAllLabel="Ver todos los pedidos"
        />
        <DashboardQuickList
          title="Pedidos listos para envío"
          description="Pagados sin envío asignado."
          emptyLabel="No hay pedidos listos para envío."
          items={metrics.ordersReadyForShipment.map<DashboardQuickItem>((o) => ({
            id: o.id,
            title: o.customer.name,
            subtitle: `${o.orderNumber} · ${fmtMoney(o.total)}`,
            badge: { kind: "order", status: "PAID" },
            meta: fmtDate(o.createdAt),
            href: `/pedidos/${o.id}` as Route,
            whatsapp: { name: o.customer.name, phone: o.customer.whatsapp },
          }))}
          viewAllHref={ROUTES.ordersPaid}
          viewAllLabel="Ver pedidos pagados"
        />
      </div>

      <AccessSection canValidate={canValidate} canManageShipment={false} />
    </>
  );
}

function DispatchDashboard({
  metrics,
  canManageShipment,
}: {
  metrics: Awaited<ReturnType<typeof getDashboardMetrics>>;
  canManageShipment: boolean;
}) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <DashboardMetricCard
          title="Pedidos listos para despacho"
          value={String(metrics.pedidosListosDespachoCount)}
          tone="success"
          hint="Pagados sin envío asignado"
          href={canManageShipment ? ROUTES.shipmentsPending : ROUTES.ordersPaid}
        />
        <DashboardMetricCard
          title="Envíos en proceso"
          value={String(metrics.enviosEnProcesoCount)}
          hint="Pendientes, preparando, listos o enviados"
          href={ROUTES.shipmentsPreparing}
        />
        <DashboardMetricCard
          title="Pagos validados del día"
          value={fmtMoney(metrics.pagosValidadosDelDia)}
          hint="Cobrado hoy"
          href={ROUTES.paymentsAll}
        />
        <DashboardMetricCard
          title="Reservas vencidas"
          value={String(metrics.reservasVencidasCount)}
          tone={metrics.reservasVencidasCount > 0 ? "destructive" : "default"}
          hint="Pedidos que requieren cancelación"
          href={ROUTES.ordersExpired}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <DashboardMetricCard
          title="Pendientes"
          value="—"
          hint="Ver envíos pendientes"
          href={ROUTES.shipmentsPending}
        />
        <DashboardMetricCard
          title="Preparando"
          value="—"
          hint="Ver envíos en preparación"
          href={ROUTES.shipmentsPreparing}
        />
        <DashboardMetricCard
          title="Listos"
          value="—"
          hint="Ver envíos listos para despachar"
          href={ROUTES.shipmentsReady}
        />
        <DashboardMetricCard
          title="Enviados"
          value="—"
          hint="Ver envíos en ruta"
          href={ROUTES.shipmentsShipped}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DashboardQuickList
          title="Pedidos listos para envío"
          description="Pagados sin envío asignado."
          emptyLabel="No hay pedidos listos para envío."
          items={metrics.ordersReadyForShipment.map<DashboardQuickItem>((o) => ({
            id: o.id,
            title: o.customer.name,
            subtitle: `${o.orderNumber} · ${fmtMoney(o.total)}`,
            badge: { kind: "order", status: "PAID" },
            meta: fmtDate(o.createdAt),
            href: `/pedidos/${o.id}` as Route,
            whatsapp: { name: o.customer.name, phone: o.customer.whatsapp },
          }))}
          viewAllHref={ROUTES.ordersPaid}
          viewAllLabel="Ver pedidos pagados"
        />
        <DashboardQuickList
          title="Envíos en proceso"
          description="Pendientes, preparando, listos o enviados."
          emptyLabel="No hay envíos en proceso."
          items={metrics.shipmentsInProgress.map<DashboardQuickItem>((s) => ({
            id: s.id,
            title: s.customer.name,
            subtitle: `${SHIPPING_METHOD_LABELS[s.shippingMethod as keyof typeof SHIPPING_METHOD_LABELS]} · ${s.orderCount} pedido(s)`,
            badge: { kind: "shipment", status: s.status },
            meta: fmtDate(s.createdAt),
            href: `/envios/${s.id}` as Route,
            whatsapp: { name: s.customer.name, phone: s.customer.whatsapp },
          }))}
          viewAllHref={ROUTES.shipmentsPreparing}
          viewAllLabel="Ver envíos en proceso"
        />
      </div>

      {canManageShipment ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Accesos rápidos</CardTitle>
            <CardDescription>
              Crear un nuevo envío o revisar el live activo.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <a
              href={ROUTES.shipmentsNew}
              className="rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
            >
              Nuevo envío
            </a>
            <a
              href={ROUTES.liveOpen}
              className="rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
            >
              Lives
            </a>
            <a
              href={ROUTES.sales}
              className="rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
            >
              Venta rápida
            </a>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

function AccessSection({
  canValidate,
  canManageShipment,
}: {
  canValidate: boolean;
  canManageShipment: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Accesos rápidos</CardTitle>
        <CardDescription>
          Accede a los módulos principales desde aquí.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2 text-sm">
        <AccessLink href={ROUTES.ordersAll} label="Pedidos" />
        <AccessLink href={ROUTES.paymentsAll} label="Pagos" />
        <AccessLink href={ROUTES.ordersExpired} label="Reservas vencidas" />
        <AccessLink href={ROUTES.customersAll} label="Clientes" />
        <AccessLink href={ROUTES.liveOpen} label="Lives" />
        <AccessLink href={ROUTES.sales} label="Venta rápida" />
        {canValidate ? (
          <AccessLink href={ROUTES.paymentsPending} label="Pagos por validar" />
        ) : null}
        {canManageShipment ? (
          <AccessLink href={ROUTES.shipmentsPending} label="Envíos" />
        ) : null}
      </CardContent>
    </Card>
  );
}

function AccessLink({ href, label }: { href: Route; label: string }) {
  return (
    <a
      href={href}
      className="rounded-md border border-border bg-card px-3 py-2 hover:bg-muted"
    >
      {label}
    </a>
  );
}

