import { notFound } from "next/navigation";

import { ProductForm } from "@/components/forms/product-form";
import { ImageUpload } from "@/components/forms/image-upload";
import { updateProductAction } from "@/actions/products";
import { getPrisma } from "@/lib/prisma";
import type { ProductActionResult } from "@/actions/products";
import { requireRole } from "@/lib/permissions";


type Params = Promise<{ id: string }>;

export default async function EditarProductoPage({ params }: { params: Params }) {
  await requireRole(["ADMIN", "SELLER"]);
  const { id } = await params;
  const prisma = getPrisma();
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) notFound();
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, isActive: true },
  });

  const boundUpdate = updateProductAction.bind(null, id) as (
    prev: ProductActionResult | undefined,
    formData: FormData,
  ) => Promise<ProductActionResult>;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Editar producto
        </h1>
        <p className="text-sm text-muted-foreground">
          Actualiza {product.name} o reemplaza su imagen principal.
        </p>
      </div>
      <ProductForm
        mode="edit"
        action={boundUpdate}
        categories={categories}
        cancelHref={`/productos/${id}`}
        initial={{
          name: product.name,
          description: product.description,
          categoryId: product.categoryId,
          isActive: product.isActive,
        }}
      />
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4">
        <p className="mb-2 text-sm font-medium">Imagen principal</p>
        <p className="mb-3 text-xs text-muted-foreground">
          La primera imagen subida se marca como principal automáticamente.
        </p>
        <ImageUpload productId={id} />
      </div>
    </div>
  );
}
