import { notFound } from "next/navigation";

import { CategoryForm } from "@/components/forms/category-form";
import { updateCategoryAction } from "@/actions/categories";
import { getPrisma } from "@/lib/prisma";
import type { CategoryActionResult } from "@/actions/categories";
import { requireRole } from "@/lib/permissions";


type Params = Promise<{ id: string }>;

export default async function EditarCategoriaPage({ params }: { params: Params }) {
  await requireRole(["ADMIN", "SELLER"]);
  const { id } = await params;
  const category = await getPrisma().category.findUnique({
    where: { id },
    select: { id: true, name: true, slug: true, isActive: true },
  });
  if (!category) notFound();

  const boundAction = updateCategoryAction.bind(null, id) as (
    prev: CategoryActionResult | undefined,
    formData: FormData,
  ) => Promise<CategoryActionResult>;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Editar categoría</h1>
        <p className="text-sm text-muted-foreground">
          Slug actual: <code className="font-mono">{category.slug}</code>
        </p>
      </div>
      <CategoryForm
        mode="edit"
        action={boundAction}
        cancelHref="/categorias"
        initial={{ name: category.name, isActive: category.isActive }}
      />
    </div>
  );
}
