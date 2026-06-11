import { ProductForm } from "@/components/forms/product-form";
import { createProductAction } from "@/actions/products";
import { getPrisma } from "@/lib/prisma";
import type { ProductActionResult } from "@/actions/products";

export const dynamic = "force-dynamic";

export default async function NuevoProductoPage() {
  const categories = await getPrisma().category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, isActive: true },
  });

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo producto</h1>
        <p className="text-sm text-muted-foreground">
          Crea el producto base. Luego podrás agregar variantes con su código
          autogenerado.
        </p>
      </div>
      <ProductForm
        mode="create"
        action={createProductAction as (
          prev: ProductActionResult | undefined,
          formData: FormData,
        ) => Promise<ProductActionResult>}
        categories={categories}
        cancelHref="/productos"
      />
    </div>
  );
}
