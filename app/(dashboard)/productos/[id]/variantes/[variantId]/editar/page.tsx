import { notFound } from "next/navigation";

import { VariantForm } from "@/components/forms/variant-form";
import { updateVariantAction } from "@/actions/products";
import { getPrisma } from "@/lib/prisma";
import type { VariantActionResult } from "@/actions/products";
import { requireRole } from "@/lib/permissions";


type Params = Promise<{ id: string; variantId: string }>;

export default async function EditarVariantePage({ params }: { params: Params }) {
  await requireRole(["ADMIN", "SELLER"]);
  const { id, variantId } = await params;
  const variant = await getPrisma().productVariant.findUnique({
    where: { id: variantId },
    select: {
      id: true,
      productId: true,
      code: true,
      color: true,
      material: true,
      size: true,
      price: true,
      cost: true,
      barcode: true,
      status: true,
    },
  });
  if (!variant || variant.productId !== id) notFound();

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Editar variante</h1>
        <p className="text-sm text-muted-foreground">
          Código actual: <code className="font-mono">{variant.code}</code>
        </p>
      </div>
      <VariantForm
        mode="edit"
        action={updateVariantAction.bind(null, variantId) as (
          prev: VariantActionResult | undefined,
          formData: FormData,
        ) => Promise<VariantActionResult>}
        cancelHref={`/productos/${id}`}
        initial={{
          color: variant.color,
          material: variant.material,
          size: variant.size,
          price: variant.price.toString(),
          cost: variant.cost?.toString() ?? null,
          barcode: variant.barcode,
          status: variant.status,
        }}
        codeHint={variant.code}
      />
    </div>
  );
}
