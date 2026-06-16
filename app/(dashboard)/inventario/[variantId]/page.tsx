import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Package, Sliders } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StockSummaryCards } from "@/components/dashboard/stock-summary";
import { MovementsTable } from "@/components/tables/movements-table";
import { InventoryAdjustForm } from "@/components/forms/inventory-adjust-form";
import { getPrisma } from "@/lib/prisma";
import {
  getMovementHistory,
  getStockSummary,
} from "@/lib/inventory";
import { formatWhatsAppDisplay } from "@/lib/phone";
import { requireRole } from "@/lib/permissions";


type Params = Promise<{ variantId: string }>;

export default async function VarianteInventarioPage({
  params,
}: {
  params: Params;
}) {
  await requireRole(["ADMIN", "SELLER", "DISPATCH"]);
  const { variantId } = await params;
  const prisma = getPrisma();
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: { product: { include: { category: true } } },
  });
  if (!variant) notFound();

  const [summary, movements] = await Promise.all([
    getStockSummary(variantId),
    getMovementHistory(variantId),
  ]);

  const productHref = `/productos/${variant.productId}`;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2"
            render={
              <Link href="/inventario">
                <ArrowLeft className="size-4" /> Inventario
              </Link>
            }
          />
          <h1 className="text-2xl font-semibold tracking-tight">
            {variant.product.name}
          </h1>
          <p className="font-mono text-sm text-muted-foreground">
            {variant.code}
            {variant.color ? ` · ${variant.color}` : ""}
            {variant.size ? ` · ${variant.size}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Categoría:{" "}
            <Link
              href={`/productos?category=${variant.product.category.id}`}
              className="hover:underline"
            >
              {variant.product.category.name}
            </Link>
            {" · "}
            <Link href={productHref} className="hover:underline">
              Ver producto
            </Link>
          </p>
        </div>
      </div>

      <StockSummaryCards summary={summary} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Historial de movimientos</CardTitle>
              <p className="text-xs text-muted-foreground">
                Más reciente primero. Incluye ingresos, reservas, ventas, liberaciones y ajustes.
              </p>
            </div>
            <Package className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <MovementsTable items={movements} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sliders className="size-4" /> Ajuste manual
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Ingreso o ajuste con motivo obligatorio.
            </p>
          </CardHeader>
          <CardContent>
            <InventoryAdjustForm variantId={variantId} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

void formatWhatsAppDisplay;
