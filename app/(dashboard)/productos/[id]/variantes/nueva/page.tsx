import { notFound } from "next/navigation";

import { VariantForm } from "@/components/forms/variant-form";
import { createVariantAction } from "@/actions/products";
import { getPrisma } from "@/lib/prisma";
import type { VariantActionResult } from "@/actions/products";
import { requireRole } from "@/lib/permissions";


type Params = Promise<{ id: string }>;

export default async function NuevaVariantePage({ params }: { params: Params }) {
  await requireRole(["ADMIN", "SELLER"]);
  const { id } = await params;
  const product = await getPrisma().product.findUnique({
    where: { id },
    include: { category: true },
  });
  if (!product) notFound();

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva variante</h1>
        <p className="text-sm text-muted-foreground">
          {product.name} · {product.category.name}
        </p>
      </div>
      <VariantForm
        mode="create"
        action={createVariantAction.bind(null, id) as (
          prev: VariantActionResult | undefined,
          formData: FormData,
        ) => Promise<VariantActionResult>}
        cancelHref={`/productos/${id}`}
      />
    </div>
  );
}
