"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";

import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { ensureUniqueSlug, slugify } from "@/lib/category-helpers";
import {
  CategoryCreateSchema,
  CategoryUpdateSchema,
  type CategoryCreateInput,
} from "@/lib/validations";

export type CategoryActionResult = {
  ok: boolean;
  message?: string;
  fieldErrors?: Partial<Record<keyof CategoryCreateInput, string>>;
};

function readForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
  };
}

function fieldErrorsFromZod(
  issues: import("zod").ZodIssue[],
): CategoryActionResult["fieldErrors"] {
  const out: CategoryActionResult["fieldErrors"] = {};
  for (const issue of issues) {
    const key = issue.path[0] as keyof CategoryCreateInput | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

export async function createCategoryAction(
  _prev: CategoryActionResult | undefined,
  formData: FormData,
): Promise<CategoryActionResult> {
  await requireRole(["ADMIN", "SELLER"]);
  const parsed = CategoryCreateSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los datos del formulario.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  const prisma = getPrisma();
  const base = slugify(parsed.data.name);
  if (!base) {
    return {
      ok: false,
      message: "El nombre no produce un slug válido.",
      fieldErrors: { name: "Usa letras o números en el nombre." },
    };
  }
  const existing = await prisma.category.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  const slug = ensureUniqueSlug(
    base,
    existing.map((c) => c.slug),
  );

  const category = await prisma.category.create({
    data: { name: parsed.data.name, slug },
  });
  revalidatePath("/categorias");
  redirect(`/categorias`);
}

export async function updateCategoryAction(
  categoryId: string,
  _prev: CategoryActionResult | undefined,
  formData: FormData,
): Promise<CategoryActionResult> {
  await requireRole(["ADMIN", "SELLER"]);
  if (!categoryId) return { ok: false, message: "Falta el identificador." };

  const raw = {
    name: String(formData.get("name") ?? "").trim(),
    isActive: formData.get("isActive") ?? undefined,
  };
  const parsed = CategoryUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los datos del formulario.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  const prisma = getPrisma();
  const existing = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!existing) return { ok: false, message: "La categoría ya no existe." };

  const base = slugify(parsed.data.name || existing.name);
  if (!base) {
    return {
      ok: false,
      message: "El nombre no produce un slug válido.",
      fieldErrors: { name: "Usa letras o números en el nombre." },
    };
  }
  const conflicts = await prisma.category.findMany({
    where: { slug: { startsWith: base }, NOT: { id: categoryId } },
    select: { slug: true },
  });
  const slug = ensureUniqueSlug(
    base,
    conflicts.map((c) => c.slug),
  );

  await prisma.category.update({
    where: { id: categoryId },
    data: {
      name: parsed.data.name,
      slug,
      ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
    },
  });
  revalidatePath("/categorias");
  revalidatePath(`/categorias/${categoryId}/editar`);
  redirect(`/categorias`);
}

export async function setCategoryActiveAction(
  categoryId: string,
  isActive: boolean,
): Promise<void> {
  await requireRole(["ADMIN", "SELLER"]);
  if (!categoryId) return;
  const prisma = getPrisma();
  await prisma.category.update({
    where: { id: categoryId },
    data: { isActive },
  });
  revalidatePath("/categorias");
}

export async function listCategoriesAction() {
  await requireRole(["ADMIN", "SELLER"]);
  const prisma = getPrisma();
  return prisma.category.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      _count: { select: { products: true } },
    },
  });
}

export type CategoryListItem = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  productCount: number;
};

void Prisma;