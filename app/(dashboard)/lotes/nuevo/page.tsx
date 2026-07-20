import type { Metadata } from "next";
import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { createBatchAction } from "@/actions/import-batches";
import { BatchForm } from "@/components/forms/batch-form";

export const metadata: Metadata = { title: "Nuevo lote de importación" };

export default async function NuevoLotePage() {
  await requireRole(["ADMIN", "SELLER"]);

  const categories = await getPrisma().category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, isActive: true },
  });

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo lote de importación</h1>
        <p className="text-sm text-muted-foreground">
          Registra un lote de compra/importación con sus productos asociados.
        </p>
      </div>
      <BatchForm
        action={createBatchAction}
        cancelHref="/lotes"
        categories={categories}
      />
    </div>
  );
}
