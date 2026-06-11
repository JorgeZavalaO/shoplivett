import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CategoriesTable } from "@/components/tables/categories-table";
import { listCategoriesAction } from "@/actions/categories";

export const dynamic = "force-dynamic";

export default async function CategoriasPage() {
  const items = await listCategoriesAction();
  const rows = items.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    isActive: c.isActive,
    productCount: c._count.products,
  }));

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Categorías</h1>
          <p className="text-sm text-muted-foreground">
            Agrupa productos para una navegación más simple.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            render={
              <Link href="/productos">Volver a productos</Link>
            }
          />
          <Button
            render={
              <Link href="/categorias/nueva">
                <Plus className="size-4" /> Nueva categoría
              </Link>
            }
          />
        </div>
      </div>

      <CategoriesTable items={rows} />
    </div>
  );
}
