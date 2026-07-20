import type { Metadata, Route } from "next";
import type { AuditAction } from "@prisma/client";

import { requirePermission } from "@/lib/authorization";
import {
  listAuditActorsAction,
  listAuditLogAction,
} from "@/actions/audit-report";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Auditoría" };

const DATE_FORMATTER = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "short",
  timeStyle: "medium",
});

const ACTION_LABELS: Record<AuditAction, string> = {
  PAYMENT_VALIDATED: "Pago validado",
  PAYMENT_REJECTED: "Pago rechazado",
  PAYMENT_APPLICATIONS_UPDATED: "Aplicación de pago actualizada",
  ORDER_CREATED: "Pedido creado",
  ORDER_CANCELLED: "Pedido cancelado",
  ORDER_EXPIRED: "Pedido vencido",
  ORDER_STATUS_CHANGED: "Cambio de estado de pedido",
  INVENTORY_ADJUSTED: "Stock ajustado",
  RESERVATION_EXPIRED: "Reserva vencida",
  SHIPMENT_CREATED: "Envío creado",
  SHIPMENT_STATUS_CHANGED: "Estado de envío cambiado",
  SHIPMENT_CANCELLED: "Envío cancelado",
  SHIPMENT_UPDATED: "Envío editado",
  PRODUCT_PRICE_CHANGED: "Precio de producto cambiado",
  PRODUCT_CREATED: "Producto creado",
  CUSTOMER_DEACTIVATED: "Clienta desactivada",
  CUSTOMER_STATUS_CHANGED: "Estado de clienta cambiado",
  CREDIT_CREATED: "Crédito creado",
  CREDIT_REFUNDED: "Devolución registrada",
  CREDIT_APPLIED: "Crédito aplicado",
  SETTINGS_UPDATED: "Configuración actualizada",
  IMPORT_BATCH_CREATED: "Lote de importación creado",
  IMPORT_BATCH_UPDATED: "Lote de importación actualizado",
  IMPORT_BATCH_STATUS_CHANGED: "Estado de lote cambiado",
  IMPORT_BATCH_ITEM_ADDED: "Producto agregado a lote",
  IMPORT_BATCH_ITEM_REMOVED: "Producto removido de lote",
  IMPORT_BATCH_ITEM_UPDATED: "Producto de lote actualizado",
  IMPORT_BATCH_RECALCULATED: "Costos de lote recalculados",
  ORDER_BATCH_ALLOCATED: "Stock de lote asignado a pedido",
  ORDER_BATCH_ALLOCATION_RELEASED: "Asignación de lote liberada",
  ORDER_PROFIT_RECOGNIZED: "Utilidad reconocida",
  EXPENSE_CREATED: "Gasto operativo creado",
  EXPENSE_UPDATED: "Gasto operativo actualizado",
  EXPENSE_VOIDED: "Gasto operativo anulado",
  INCIDENT_CREATED: "Incidencia creada",
  INCIDENT_RESOLVED: "Incidencia resuelta",
  INCIDENT_CANCELLED: "Incidencia cancelada",
};

const ACTION_TONE: Record<AuditAction, string> = {
  PAYMENT_VALIDATED: "bg-emerald-600 text-white",
  PAYMENT_REJECTED: "bg-destructive text-white",
  PAYMENT_APPLICATIONS_UPDATED: "bg-blue-200 text-blue-900",
  ORDER_CREATED: "bg-emerald-600 text-white",
  ORDER_CANCELLED: "bg-destructive text-white",
  ORDER_EXPIRED: "bg-amber-500 text-white",
  ORDER_STATUS_CHANGED: "bg-blue-200 text-blue-900",
  INVENTORY_ADJUSTED: "bg-amber-500 text-white",
  RESERVATION_EXPIRED: "bg-amber-500 text-white",
  SHIPMENT_CREATED: "bg-emerald-600 text-white",
  SHIPMENT_STATUS_CHANGED: "bg-blue-200 text-blue-900",
  SHIPMENT_CANCELLED: "bg-destructive text-white",
  SHIPMENT_UPDATED: "bg-blue-200 text-blue-900",
  PRODUCT_PRICE_CHANGED: "bg-blue-200 text-blue-900",
  PRODUCT_CREATED: "bg-emerald-600 text-white",
  CUSTOMER_DEACTIVATED: "bg-muted text-muted-foreground",
  CUSTOMER_STATUS_CHANGED: "bg-muted text-muted-foreground",
  CREDIT_CREATED: "bg-emerald-600 text-white",
  CREDIT_REFUNDED: "bg-amber-500 text-white",
  CREDIT_APPLIED: "bg-blue-200 text-blue-900",
  SETTINGS_UPDATED: "bg-blue-200 text-blue-900",
  IMPORT_BATCH_CREATED: "bg-emerald-600 text-white",
  IMPORT_BATCH_UPDATED: "bg-blue-200 text-blue-900",
  IMPORT_BATCH_STATUS_CHANGED: "bg-amber-500 text-white",
  IMPORT_BATCH_ITEM_ADDED: "bg-emerald-600 text-white",
  IMPORT_BATCH_ITEM_REMOVED: "bg-destructive text-white",
  IMPORT_BATCH_ITEM_UPDATED: "bg-blue-200 text-blue-900",
  IMPORT_BATCH_RECALCULATED: "bg-blue-200 text-blue-900",
  ORDER_BATCH_ALLOCATED: "bg-emerald-600 text-white",
  ORDER_BATCH_ALLOCATION_RELEASED: "bg-amber-500 text-white",
  ORDER_PROFIT_RECOGNIZED: "bg-emerald-600 text-white",
  EXPENSE_CREATED: "bg-emerald-600 text-white",
  EXPENSE_UPDATED: "bg-blue-200 text-blue-900",
  EXPENSE_VOIDED: "bg-destructive text-white",
  INCIDENT_CREATED: "bg-amber-500 text-white",
  INCIDENT_RESOLVED: "bg-emerald-600 text-white",
  INCIDENT_CANCELLED: "bg-muted text-muted-foreground",
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isAction(value: string | undefined): value is AuditAction {
  if (!value) return false;
  return Object.prototype.hasOwnProperty.call(ACTION_LABELS, value);
}

function buildHref(sp: SearchParams, patch: Record<string, string | null>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v == null) continue;
    const value = Array.isArray(v) ? v[0] : v;
    if (value !== undefined && value !== "") params.set(k, value);
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === "") params.delete(k);
    else params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `/auditoria?${qs}` : "/auditoria";
}

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePermission("audit.read");
  const sp = await searchParams;

  const fromInput = first(sp, "from") ?? "";
  const toInput = first(sp, "to") ?? "";
  const actionParam = first(sp, "action");
  const action: AuditAction | "ALL" = isAction(actionParam)
    ? actionParam
    : "ALL";
  const entity = (first(sp, "entity") ?? "ALL").trim() || "ALL";
  const actorId = (first(sp, "actorId") ?? "").trim() || undefined;
  const query = first(sp, "q") ?? "";
  const page = Math.max(1, Number(first(sp, "page") ?? "1") || 1);

  const [data, actors] = await Promise.all([
    listAuditLogAction({
      from: parseDate(fromInput),
      to: parseDate(toInput),
      action,
      entity,
      actorId,
      query,
      page,
      perPage: 25,
    }),
    listAuditActorsAction(),
  ]);

  const knownActions = Object.keys(ACTION_LABELS) as AuditAction[];
  const knownEntities = Array.from(
    new Set(["ALL", ...data.byEntity.map((b) => b.entity)]),
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Auditoría</h1>
        <p className="text-sm text-muted-foreground">
          Registro inmutable de acciones críticas. Sólo lectura. La tabla
          <code> AuditLog</code> no expone actualización ni borrado desde la UI.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>
            Filtra por fecha, acción, entidad, actor o texto libre. La búsqueda
            por texto revisa <code>entityId</code>, <code>entity</code>, acción,
            email y nombre del actor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            method="get"
            action={"/auditoria" as Route}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor="from" className="text-xs text-muted-foreground">
                Desde
              </label>
              <Input id="from" name="from" type="date" defaultValue={fromInput} className="w-40" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="to" className="text-xs text-muted-foreground">
                Hasta
              </label>
              <Input id="to" name="to" type="date" defaultValue={toInput} className="w-40" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="action" className="text-xs text-muted-foreground">
                Acción
              </label>
              <select
                id="action"
                name="action"
                defaultValue={action}
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
              >
                <option value="ALL">Todas</option>
                {knownActions.map((a) => (
                  <option key={a} value={a}>
                    {ACTION_LABELS[a]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="entity" className="text-xs text-muted-foreground">
                Entidad
              </label>
              <select
                id="entity"
                name="entity"
                defaultValue={entity}
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
              >
                {knownEntities.map((e) => (
                  <option key={e} value={e}>
                    {e === "ALL" ? "Todas" : e}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="actorId" className="text-xs text-muted-foreground">
                Actor
              </label>
              <select
                id="actorId"
                name="actorId"
                defaultValue={actorId ?? ""}
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
              >
                <option value="">Todos</option>
                {actors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name ?? a.email ?? a.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-1 flex-col gap-1.5 min-w-48">
              <label htmlFor="q" className="text-xs text-muted-foreground">
                Buscar
              </label>
              <Input id="q" name="q" defaultValue={query} placeholder="entityId, actor, email…" />
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm">
                Aplicar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                render={<a href={"/auditoria" as Route}>Limpiar</a>}
              />
            </div>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            Eventos en el filtro: <span className="font-medium">{data.total}</span>
          </p>
        </CardContent>
      </Card>

      {data.byAction.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Por acción</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {data.byAction.slice(0, 10).map((b) => (
                <Badge
                  key={b.action}
                  className={`text-[10px] ${ACTION_TONE[b.action] ?? ""}`}
                >
                  {ACTION_LABELS[b.action] ?? b.action} · {b.count}
                </Badge>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Por entidad</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {data.byEntity.map((b) => (
                <Badge key={b.entity} variant="outline" className="text-[10px]">
                  {b.entity} · {b.count}
                </Badge>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eventos</CardTitle>
          <CardDescription>
            {data.total === 0
              ? "No hay eventos para los filtros seleccionados."
              : `Mostrando ${data.items.length} de ${data.total}.`}
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
                    <TableHead>Fecha</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Entidad</TableHead>
                    <TableHead>EntityId</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Metadata</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {DATE_FORMATTER.format(new Date(it.createdAt))}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`text-[10px] ${ACTION_TONE[it.action] ?? ""}`}
                        >
                          {ACTION_LABELS[it.action] ?? it.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {it.entity}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {it.entityId}
                      </TableCell>
                      <TableCell className="text-xs">
                        {it.actorName ?? it.actorEmail ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-md text-xs">
                        <pre className="whitespace-pre-wrap break-words text-muted-foreground">
                          {it.metadata ? JSON.stringify(it.metadata, null, 0) : "—"}
                        </pre>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {data.total > data.perPage ? (
        <PaginationLinks
          page={data.page}
          perPage={data.perPage}
          total={data.total}
          buildHref={(next) =>
            buildHref(sp, { page: next > 1 ? String(next) : null }) as Route
          }
        />
      ) : null}
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
