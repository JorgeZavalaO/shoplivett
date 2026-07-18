import { ProductCreateForm } from "@/components/forms/product-create-form";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";


export const dynamic = "force-dynamic";

export default async function NuevoProductoPage() {
  await requireRole(["ADMIN", "SELLER"]);
  const categories = await getPrisma().category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, isActive: true },
  });

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo producto</h1>
        <p className="text-sm text-muted-foreground">
          Crea el producto, define sus variantes con precio y stock, y sube su
          foto principal en una sola pantalla.
        </p>
      </div>
      <ProductCreateForm categories={categories} cancelHref="/productos" />
    </div>
  );
}
