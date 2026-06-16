import { CategoryForm } from "@/components/forms/category-form";
import { createCategoryAction } from "@/actions/categories";
import type { CategoryActionResult } from "@/actions/categories";
import { requireRole } from "@/lib/permissions";


export default async function NuevaCategoriaPage() {
  await requireRole(["ADMIN", "SELLER"]);
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva categoría</h1>
        <p className="text-sm text-muted-foreground">
          El slug se genera automáticamente a partir del nombre.
        </p>
      </div>
      <CategoryForm
        mode="create"
        action={createCategoryAction as (
          prev: CategoryActionResult | undefined,
          formData: FormData,
        ) => Promise<CategoryActionResult>}
        cancelHref="/categorias"
      />
    </div>
  );
}
