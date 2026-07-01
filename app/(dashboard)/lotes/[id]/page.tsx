import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, PackageIcon, Calculator } from "lucide-react";

import { requireRole } from "@/lib/permissions";
import { getBatchDetailAction } from "@/actions/import-batches";
import { BatchHealthBadge } from "@/components/financial/batch-health-badge";
import { MarginBadge } from "@/components/financial/margin-badge";
import { StockHealthBadge } from "@/components/financial/stock-health-badge";
import { BatchStatusBadge } from "@/components/tables/batch-status-badge";
import { Button } from "@/components/ui/button";
import { RecalculateBatchButton } from "@/components/forms/recalculate-batch-button";
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
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          render={
            <Link href="/lotes">
              <ArrowLeft className="size-4" /> Volver
            </Link>
          }
        />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight font-mono">
              {batch.code}
            </h1>
            <BatchStatusBadge status={batch.status as "PURCHASED" | "IN_TRANSIT" | "COMPLETE" | "CLOSED"} />
            {isCalculated ? (
              <BatchHealthBadge status={batch.status} marginBps={batchMarginBps} />
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {batch.shopper} · {batch.agency}
          </p>
        </div>
        {items.length > 0 && (
          <RecalculateBatchButton batchId={batch.id} />
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total invertido</p>
          <p className="mt-1 text-2xl font-semibold">
            {formatPen(batch.totalInvestmentPen)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatUsd(batch.totalCostUsd)} + adicionales
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Productos</p>
          <p className="mt-1 text-2xl font-semibold">{items.length}</p>
          <p className="text-xs text-muted-foreground">
            {totalItems} comprados · {totalReceived} recibidos
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Distribución de costos</p>
          <p className="mt-1 text-base font-medium">
            {distributionLabel ?? "Sin calcular"}
          </p>
          <p className="text-xs text-muted-foreground">
            {batch.lastRecalculatedAt
              ? `Último: ${new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short" }).format(new Date(batch.lastRecalculatedAt))}`
              : "Pendiente de recálculo"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
        <span className="text-xs">Creado por {batch.createdBy?.name ?? "Sistema"}</span>
        <span aria-hidden>·</span>
        <span className="text-xs">
          {new Intl.DateTimeFormat("es-PE", {
            dateStyle: "long",
            timeStyle: "short",
          }).format(new Date(batch.createdAt))}
        </span>
        <span aria-hidden>·</span>
        <span className="text-xs">Tipo de cambio: {Number(batch.exchangeRate.toString()).toFixed(4)}</span>
      </div>

      {batch.notes && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Notas</p>
          <p className="mt-1 text-sm whitespace-pre-wrap">{batch.notes}</p>
        </div>
      )}

      {!isCalculated && items.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <Calculator className="mt-0.5 size-5 text-amber-600 dark:text-amber-400" />
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

      {isCalculated && lowMarginItems.length > 0 ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <Calculator className="mt-0.5 size-5 text-amber-600 dark:text-amber-400" />
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
                  <th className="p-3 font-medium">Producto</th>
                  <th className="p-3 font-medium">Código</th>
                  <th className="p-3 font-medium">Cantidad</th>
                  <th className="p-3 font-medium">Costo base PEN</th>
                  {isCalculated && (
                    <>
                      <th className="p-3 font-medium">Adicional unit.</th>
                      <th className="p-3 font-medium bg-emerald-50 dark:bg-emerald-900/10">Costo aterrizado</th>
                      <th className="p-3 font-medium">Subtotal aterrizado</th>
                      <th className="p-3 font-medium">Precio mín.</th>
                      <th className="p-3 font-medium">Precio sug.</th>
                      <th className="p-3 font-medium">Margen actual</th>
                    </>
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
                    <tr key={item.id} className="border-b border-border/50">
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
                          <span className="text-xs">
                            {item.quantityPurchased}p · {item.quantityReceived}r · {item.quantityAvailable}d
                          </span>
                          <StockHealthBadge availableUnits={item.quantityAvailable} />
                        </div>
                      </td>
                      <td className="p-3 font-mono text-xs">
                        S/ {Number(item.unitCostPen.toString()).toFixed(4)}
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
                          <td className="p-3 font-mono text-xs text-muted-foreground">
                            {formatPen(pricing.minimumPrice)}
                          </td>
                          <td className="p-3 font-mono text-xs">
                            {formatPen(pricing.suggestedPrice)}
                          </td>
                          <td className="p-3">
                            <MarginBadge percent={pricing.currentMarginPercent} />
                          </td>
                        </>
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
