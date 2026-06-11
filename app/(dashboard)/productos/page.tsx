import Link from "next/link";
import { Plus, Tag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProductsTable } from "@/components/tables/products-table";
import { searchProductsAction } from "@/actions/products";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string | string[];
  page?: string | string[];
  category?: string | string[];
}>;

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const q = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const pageRaw = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const page = pageRaw ? Math.max(1, Number(pageRaw)) || 1 : 1;
  const categoryRaw = Array.isArray(sp.category) ? sp.category[0] : sp.category;
  const categoryId = categoryRaw && categoryRaw !== "all" ? categoryRaw : undefined;

  const [result, categories] = await Promise.all([
    searchProductsAction(q ?? "", page, 20, categoryId),
    getPrisma().category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const items = result.items.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    isActive: p.isActive,
    createdAt: p.createdAt,
    category: p.category,
    variantCount: p._count.variants,
  }));

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Productos</h1>
          <p className="text-sm text-muted-foreground">
            Catálogo interno. Busca por nombre o código de variante.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            render={
              <Link href="/categorias">
                <Tag className="size-4" /> Categorías
              </Link>
            }
          />
          <Button
            render={
              <Link href="/productos/nuevo">
                <Plus className="size-4" /> Nuevo producto
              </Link>
            }
          />
        </div>
      </div>

      <ProductsTable
        items={items}
        total={result.total}
        page={result.page}
        perPage={result.perPage}
        query={result.query}
        categoryId={categoryId ?? null}
        categories={categories}
      />
    </div>
  );
}
