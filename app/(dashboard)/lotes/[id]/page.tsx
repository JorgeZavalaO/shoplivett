import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, PackageIcon, Calculator, DollarSign, Receipt, Scale, TrendingUp, Clock, User, Hash, BadgeInfo, Calendar, Ship } from "lucide-react";

import { requireRole } from "@/lib/permissions";
import { getBatchDetailAction } from "@/actions/import-batches";
import { BatchHealthBadge } from "@/components/financial/batch-health-badge";
import { MarginBadge } from "@/components/financial/margin-badge";
import { StockHealthBadge } from "@/components/financial/stock-health-badge";
import { BatchStatusBadge } from "@/components/tables/batch-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RecalculateBatchButton } from "@/components/forms/recalculate-batch-button";
import { BatchDetailActions } from "@/components/forms/batch-detail-actions";
import { RemoveBatchItemButton } from "@/components/forms/remove-batch-item-button";
import { EditBatchItemButton } from "@/components/forms/edit-batch-item-button";
import { ApplyPriceButton } from "@/components/forms/apply-price-button";
import { getSettings } from "@/lib/settings";
import { COST_ALLOCATION_METHOD_LABELS } from "@/lib/settings-defaults";
import { getItemPricing } from "@/lib/import-batch-costing";

type Params = Promise<{ id: string }>;

type BatchItem = {
  id: string;
  quantityPurchased: number;
  quantityReceived: number;
  quantityAvailable: number;
  unitCostUsd: { toString(): string };
  unitCostPen: { toString(): string };
  weight: { toString(): string };
  subtotalUsd: { toString(): string };
  subtotalPen: { toString(): string };
  additionalSubtotalPen: { toString(): string };
  additionalCostPen: { toString(): string };
  landedUnitCostPen: { toString(): string };
  landedSubtotalPen: { toString(): string };
  calculatedAt: Date | null;
  variant: {
    id: string;
    code: string;
    color: string | null;
    price: { toString(): string };
    stock: number;
    product: { id: string; name: string };
  };
};

type BatchView = {
  id: string;
  code: string;
  purchaseDate: Date;
  estimatedArrivalDate: Date | null;
  shopper: string;
  agency: string;
  totalCostUsd: { toString(): string };
  totalAdditionalCostsUsd: { toString(): string };
  totalAdditionalCostsPen: { toString(): string };
  exchangeRate: { toString(): string };
  totalInvestmentPen: { toString(): string };
  status: string;
  distributionMethod: string | null;
  lastRecalculatedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { id: string; name: string } | null;
  items: BatchItem[];
};

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const batch = await getBatchDetailAction(id) as BatchView | null;
  if (!batch) return { title: "Lote no encontrado" };
  return { title: `Lote ${batch.code}` };
}

function formatPen(val: { toString(): string } | number) {
  const n = Number(typeof val === "number" ? val : val.toString());
  return `S/ ${n.toFixed(2)}`;
}

function formatUsd(val: { toString(): string } | number) {
  const n = Number(typeof val === "number" ? val : val.toString());
  return `$ ${n.toFixed(2)}`;
}

export default async function LoteDetailPage({
  params,
}: {
  params: Params;
}) {
  await requireRole(["ADMIN", "SELLER"]);
  const { id } = await params;
  const batch = await getBatchDetailAction(id) as BatchView | null;
  if (!batch) notFound();

  const settings = await getSettings();
  const margins = {
    minimumTargetMarginBps: settings.minimumTargetMarginBps,
    objectiveTargetMarginBps: settings.objectiveTargetMarginBps,
  };

  const items = batch.items ?? [];
  const totalItems = items.reduce((sum: number, i: BatchItem) => sum + i.quantityPurchased, 0);
  const totalReceived = items.reduce((sum: number, i: BatchItem) => sum + i.quantityReceived, 0);
  const totalWeight = items.reduce((sum: number, i: BatchItem) => sum + Number(i.weight.toString()), 0);
  const isCalculated = items.length > 0 && items.every((i) => i.calculatedAt !== null);
  const methodLabel = batch.distributionMethod
    ? COST_ALLOCATION_METHOD_LABELS[batch.distributionMethod as keyof typeof COST_ALLOCATION_METHOD_LABELS] ?? batch.distributionMethod
    : null;
  const distributionLabel = batch.lastRecalculatedAt ? methodLabel : "Pendiente de recálculo";
  const pricedItems = isCalculated
    ? items.map((item: BatchItem) => {
        const landingCost = Number(item.landedUnitCostPen.toString());
        const currentPrice = Number(item.variant.price.toString());
        const pricing = getItemPricing(landingCost, currentPrice, margins);
        return {
          item,
          pricing,
          revenue: currentPrice * item.quantityReceived,
          cost: landingCost * item.quantityReceived,
        };
      })
    : [];
  const lowMarginItems = pricedItems.filter(
    (entry) => entry.pricing.currentMarginPercent < settings.minimumTargetMarginBps / 100,
  );
  const batchRevenueEstimate = pricedItems.reduce((sum, entry) => sum + entry.revenue, 0);
  const batchCostEstimate = pricedItems.reduce((sum, entry) => sum + entry.cost, 0);
  const batchMarginBps =
    batchRevenueEstimate > 0
      ? Math.round(((batchRevenueEstimate - batchCostEstimate) * 10000) / batchRevenueEstimate)
      : 0;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-4">
        <Button
          variant="ghost"
          size="sm"
          render={
            <Link href="/lotes">
              <ArrowLeft className="size-4" /> Volver
            </Link>
          }
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight font-mono">
                {batch.code}
              </h1>
              <BatchStatusBadge status={batch.status as "PURCHASED" | "IN_TRANSIT" | "COMPLETE" | "CLOSED"} />
            </div>
            {isCalculated ? (
              <BatchHealthBadge status={batch.status} marginBps={batchMarginBps} />
            ) : null}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {items.length > 0 && (
                <RecalculateBatchButton batchId={batch.id} />
              )}
              <BatchDetailActions
                batchId={batch.id}
                isClosed={batch.status === "CLOSED"}
                defaultValues={{
                  purchaseDate: new Date(batch.purchaseDate).toISOString().split("T")[0],
                  estimatedArrivalDate: batch.estimatedArrivalDate ? new Date(batch.estimatedArrivalDate).toISOString().split("T")[0] : "",
                  shopper: batch.shopper,
                  agency: batch.agency,
                  totalCostUsd: Number(batch.totalCostUsd.toString()).toFixed(2),
                  totalAdditionalCostsUsd: Number(batch.totalAdditionalCostsUsd.toString()).toFixed(2),
                  totalAdditionalCostsPen: Number(batch.totalAdditionalCostsPen.toString()).toFixed(2),
                  exchangeRate: Number(batch.exchangeRate.toString()).toFixed(4),
                  notes: batch.notes ?? "",
                }}
              />
            </div>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <User className="size-3.5" />
              {batch.shopper}
            </span>
            <span className="flex items-center gap-1.5">
              <BadgeInfo className="size-3.5" />
              {batch.agency}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="size-3.5" />
              {new Intl.DateTimeFormat("es-PE", { dateStyle: "long" }).format(new Date(batch.purchaseDate))}
            </span>
            {batch.estimatedArrivalDate && (
              <span className="flex items-center gap-1.5">
                <Ship className="size-3.5" />
                Llegada estimada: {new Intl.DateTimeFormat("es-PE", { dateStyle: "long" }).format(new Date(batch.estimatedArrivalDate))}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Hash className="size-3.5" />
              Creado por {batch.createdBy?.name ?? "Sistema"}
            </span>
          </div>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card size="sm">
          <CardHeader className="flex-row items-center gap-2 border-b-0 pb-0">
            <DollarSign className="size-4 text-emerald-600 dark:text-emerald-400" />
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total invertido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatPen(batch.totalInvestmentPen)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatUsd(batch.totalCostUsd)} + adicionales &middot; TC {Number(batch.exchangeRate.toString()).toFixed(3)}
            </p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="flex-row items-center gap-2 border-b-0 pb-0">
            <PackageIcon className="size-4 text-blue-600 dark:text-blue-400" />
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Productos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{items.length}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {totalItems} comprados &middot; {totalReceived} recibidos
            </p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="flex-row items-center gap-2 border-b-0 pb-0">
            <TrendingUp className="size-4 text-violet-600 dark:text-violet-400" />
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Distribución de costos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base font-medium">{distributionLabel ?? "Sin calcular"}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {batch.lastRecalculatedAt
                ? new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short" }).format(new Date(batch.lastRecalculatedAt))
                : "Pendiente de recálculo"}
            </p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="flex-row items-center gap-2 border-b-0 pb-0">
            <Scale className="size-4 text-amber-600 dark:text-amber-400" />
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Peso total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{totalWeight > 0 ? `${totalWeight.toFixed(2)} kg` : "—"}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {totalWeight > 0 ? `${items.filter((i) => Number(i.weight.toString()) > 0).length} productos con peso` : "Sin registrar"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      {batch.notes && (
        <Card size="sm">
          <CardContent className="flex items-start gap-3">
            <Receipt className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">Notas</p>
              <p className="mt-0.5 text-sm whitespace-pre-wrap">{batch.notes}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerts */}
      {!isCalculated && items.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <Calculator className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              Costos aterrizados pendientes
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-300">
              Este lote aún no tiene costos aterrizados. Ejecuta el recálculo para
              distribuir los costos adicionales y obtener el costo real por unidad.
            </p>
          </div>
        </div>
      )}

      {isCalculated && items.some((i) => Number(i.variant.price.toString()) === 0) && (
        <div className="flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4 dark:border-sky-800 dark:bg-sky-900/20">
          <DollarSign className="mt-0.5 size-5 shrink-0 text-sky-600 dark:text-sky-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-sky-900 dark:text-sky-200">
              Productos sin precio de venta
            </p>
            <p className="text-xs text-sky-800 dark:text-sky-300">
              {items.filter((i) => Number(i.variant.price.toString()) === 0).length} producto(s) del lote no tienen precio asignado. Usa el botón <strong>Aplicar</strong> en la columna "Precio sug." para asignar el precio sugerido automáticamente.
            </p>
          </div>
        </div>
      )}

      {isCalculated && lowMarginItems.length > 0 ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <TrendingUp className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              Lote con rentabilidad baja
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-300">
              {lowMarginItems.length} producto(s) del lote tienen precio actual por debajo del margen mínimo objetivo de {settings.minimumTargetMarginBps / 100}%.
            </p>
          </div>
        </div>
      ) : null}

      {/* Products table */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Productos del lote</h2>
          {isCalculated && (
            <div className="flex flex-wrap gap-1.5">
              <MarginBadge bps={settings.minimumTargetMarginBps} />
              <MarginBadge bps={settings.objectiveTargetMarginBps} />
            </div>
          )}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-8 text-center">
            <PackageIcon className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Este lote no tiene productos asociados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="sticky top-0 z-10 bg-card p-3 font-medium">Producto</th>
                  <th className="sticky top-0 z-10 bg-card p-3 font-medium">Código</th>
                  <th className="sticky top-0 z-10 bg-card p-3 font-medium">Cantidad</th>
                  <th className="sticky top-0 z-10 bg-card p-3 font-medium">Costo base PEN</th>
                  <th className="sticky top-0 z-10 bg-card p-3 font-medium">Peso</th>
                  {isCalculated && (
                    <>
                      <th className="sticky top-0 z-10 bg-card p-3 font-medium">Adicional unit.</th>
                      <th className="sticky top-0 z-10 bg-emerald-50 p-3 font-medium dark:bg-emerald-900/10">Costo aterrizado</th>
                      <th className="sticky top-0 z-10 bg-card p-3 font-medium">Subtotal aterrizado</th>
                      <th className="sticky top-0 z-10 bg-card p-3 font-medium">Precio actual</th>
                      <th className="sticky top-0 z-10 bg-card p-3 font-medium">Precio mín.</th>
                      <th className="sticky top-0 z-10 bg-card p-3 font-medium">Precio sug.</th>
                      <th className="sticky top-0 z-10 bg-card p-3 font-medium">Margen</th>
                    </>
                  )}
                  {batch.status !== "CLOSED" && (
                    <th className="sticky top-0 z-10 bg-card p-3 font-medium w-12"></th>
                  )}
                </tr>
              </thead>
              <tbody>
                {items.map((item: BatchItem) => {
                  const landingCost = Number(item.landedUnitCostPen.toString());
                  const currentPrice = Number(item.variant.price.toString());
                  const pricing = isCalculated
                    ? getItemPricing(landingCost, currentPrice, margins)
                    : null;
                  return (
                    <tr key={item.id} className="border-b border-border/50 transition-colors hover:bg-muted/30">
                      <td className="p-3">
                        <Link
                          href={`/productos/${item.variant.product.id}`}
                          className="font-medium hover:underline"
                        >
                          {item.variant.product.name}
                        </Link>
                        {item.variant.color && (
                          <span className="ml-1 text-muted-foreground">
                            ({item.variant.color})
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">
                        {item.variant.code}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          <span className="group relative cursor-help">
                            <span className="text-xs underline decoration-dotted underline-offset-2">
                              {item.quantityPurchased}p · {item.quantityReceived}r · {item.quantityAvailable}d
                            </span>
                            <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md opacity-0 transition-opacity group-hover:opacity-100">
                              <p><strong>p</strong> = comprados · Lo que se ordenó al proveedor</p>
                              <p><strong>r</strong> = recibidos · Lo que ya está en el almacén</p>
                              <p><strong>d</strong> = disponibles · Lo que queda sin vender de este lote</p>
                            </span>
                          </span>
                          <StockHealthBadge availableUnits={item.quantityAvailable} received={item.quantityReceived} />
                        </div>
                      </td>
                      <td className="p-3 font-mono text-xs">
                        S/ {Number(item.unitCostPen.toString()).toFixed(4)}
                      </td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">
                        {Number(item.weight.toString()) > 0 ? `${Number(item.weight.toString()).toFixed(3)} kg` : "—"}
                      </td>
                      {isCalculated && pricing && (
                        <>
                          <td className="p-3 font-mono text-xs">
                            S/ {Number(item.additionalCostPen.toString()).toFixed(4)}
                          </td>
                          <td className="p-3 font-mono text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/10">
                            S/ {landingCost.toFixed(4)}
                          </td>
                          <td className="p-3 font-mono text-xs">
                            S/ {Number(item.landedSubtotalPen.toString()).toFixed(2)}
                          </td>
                          <td className="p-3 font-mono text-xs">
                            {currentPrice > 0 ? (
                              formatPen(currentPrice)
                            ) : (
                              <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-dashed text-[10px]">
                                Sin precio
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 font-mono text-xs text-muted-foreground">
                            {formatPen(pricing.minimumPrice)}
                          </td>
                          <td className="p-3 font-mono text-xs">
                            {formatPen(pricing.suggestedPrice)}
                            {currentPrice <= 0 && (
                              <div className="mt-1">
                                <ApplyPriceButton
                                  variantId={item.variant.id}
                                  price={pricing.suggestedPrice}
                                />
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            {currentPrice > 0 ? (
                              <MarginBadge percent={pricing.currentMarginPercent} />
                            ) : (
                              <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-dashed text-[10px]">
                                Pendiente
                              </Badge>
                            )}
                          </td>
                        </>
                      )}
                      {batch.status !== "CLOSED" && (
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <EditBatchItemButton
                              batchId={batch.id}
                              item={{
                                id: item.id,
                                productName: item.variant.product.name,
                                variantCode: item.variant.code,
                                quantityPurchased: item.quantityPurchased,
                                quantityReceived: item.quantityReceived,
                                unitCostUsd: Number(item.unitCostUsd.toString()).toFixed(4),
                                weight: Number(item.weight.toString()).toFixed(4),
                              }}
                            />
                            <RemoveBatchItemButton
                              batchId={batch.id}
                              itemId={item.id}
                              productName={item.variant.product.name}
                            />
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
