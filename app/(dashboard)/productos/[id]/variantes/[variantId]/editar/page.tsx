import { notFound } from "next/navigation";

import { VariantForm } from "@/components/forms/variant-form";
import { updateVariantAction } from "@/actions/products";
import { getPrisma } from "@/lib/prisma";
import type { VariantActionResult } from "@/actions/products";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string; variantId: string }>;

export default async function EditarVariantePage({ params }: { params: Params }) {
  const { id, variantId } = await params;
  const variant = await getPrisma().productVariant.findUnique({
    where: { id: variantId },
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
