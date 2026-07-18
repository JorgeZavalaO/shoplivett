"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";

import { requireRole, getCurrentUser } from "@/lib/permissions";
import { auditAfter } from "@/lib/audit";
import { getPrisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { uploadImage, deleteImage, ImageUploadError, validateImageBatch } from "@/lib/blob";
import {
  ProductCreateSchema,
  ProductUpdateSchema,
  ProductVariantCreateSchema,
  ProductVariantUpdateSchema,
  ProductCreateWithVariantsSchema,
  type ProductCreateInput,
  type ProductCreateWithVariantsInput,
  type ProductVariantCreateInput,
} from "@/lib/validations";
import {
  buildVariantCode,
  nextAvailableSuffix,
  MAX_ATTEMPTS,
} from "@/lib/product-codes";

export type ProductActionResult = {
  ok: boolean;
  message?: string;
  fieldErrors?: Partial<Record<keyof ProductCreateInput, string>>;
  code?: string;
};

export type ProductCreateWithVariantsResult = {
  ok: boolean;
  message?: string;
  fieldErrors?: Partial<Record<keyof ProductCreateWithVariantsInput | "root", string>>;
  code?: string;
};

export type VariantActionResult = {
  ok: boolean;
  message?: string;
  fieldErrors?: Partial<Record<keyof ProductVariantCreateInput, string>>;
};

function fieldErrors<T extends string>(
  issues: import("zod").ZodIssue[],
): Partial<Record<T, string>> {
  const out: Partial<Record<T, string>> = {};
  for (const issue of issues) {
    const key = issue.path[0] as T | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

function readForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    categoryId: String(formData.get("categoryId") ?? "").trim(),
    isActive: formData.get("isActive") ?? undefined,
  };
}

// =====================================================================
// Products
// =====================================================================

export async function createProductAction(
  _prev: ProductActionResult | undefined,
  formData: FormData,
): Promise<ProductActionResult> {
  await requireRole(["ADMIN", "SELLER"]);
  const parsed = ProductCreateSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los datos del formulario.",
      fieldErrors: fieldErrors<keyof ProductCreateInput>(parsed.error.issues),
    };
  }

  const prisma = getPrisma();
  const category = await prisma.category.findUnique({
    where: { id: parsed.data.categoryId },
  });
  if (!category || !category.isActive) {
    return {
      ok: false,
      message: "La categoría seleccionada no está disponible.",
      fieldErrors: { categoryId: "Selecciona una categoría activa." },
    };
  }

  const product = await prisma.product.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      categoryId: parsed.data.categoryId,
    },
  });
  revalidatePath("/productos");
  redirect(`/productos/${product.id}`);
}

/**
 * Alta combinada: crea el producto base, sus variantes (con códigos
 * autogenerados) y, de forma opcional, una imagen principal. Todo se
 * persiste en una sola transacción; si algo falla, se compensan los blobs
 * ya subidos.
 */
export async function createProductWithVariantsAction(
  _prev: ProductCreateWithVariantsResult | undefined,
  formData: FormData,
): Promise<ProductCreateWithVariantsResult> {
  await requireRole(["ADMIN", "SELLER"]);

  const parsed = ProductCreateWithVariantsSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    categoryId: String(formData.get("categoryId") ?? "").trim(),
    hasVariants: formData.get("hasVariants") ?? "false",
    variants: String(formData.get("variants") ?? ""),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los datos del formulario.",
      fieldErrors: fieldErrors<keyof ProductCreateWithVariantsInput | "root">(
        parsed.error.issues,
      ),
    };
  }

  const prisma = getPrisma();
  const category = await prisma.category.findUnique({
    where: { id: parsed.data.categoryId },
  });
  if (!category || !category.isActive) {
    return {
      ok: false,
      message: "La categoría seleccionada no está disponible.",
      fieldErrors: { categoryId: "Selecciona una categoría activa." },
    };
  }

  // Imagen opcional: si llega un File válido se sube al Blob antes de tocar
  // la base de datos. Si falla la subida, devolvemos error sin crear nada.
  const imageFile = formData.get("image");
  let uploadedImage: { url: string; pathname: string } | null = null;
  if (imageFile instanceof File && imageFile.size > 0) {
    try {
      validateImageBatch([imageFile], { maxFiles: 1, maxTotalBytes: 5 * 1024 * 1024 });
    } catch (error) {
      if (error instanceof ImageUploadError) {
        return { ok: false, message: error.message, code: "IMAGE_ERROR" };
      }
      throw error;
    }
    try {
      const tempId = `new-${Date.now()}`;
      const uploaded = await uploadImage(
        imageFile,
        `products/${tempId}`,
        tempId,
      );
      uploadedImage = { url: uploaded.url, pathname: uploaded.pathname };
    } catch (error) {
      if (error instanceof ImageUploadError) {
        return { ok: false, message: error.message, code: "IMAGE_ERROR" };
      }
      throw error;
    }
  }

  const settings = await getSettings();
  const prefix = settings.productCodePrefix;

  // Cargamos los códigos existentes de la categoría para alimentar
  // `nextAvailableSuffix`. Se hace fuera de la transacción para no
  // inflar la duración del bloqueo serializable.
  const existingCodes = await prisma.productVariant.findMany({
    where: { product: { categoryId: parsed.data.categoryId } },
    select: { code: true },
  });
  const codeList = existingCodes.map((v) => v.code);

  // Pre-generamos los códigos para cada variante. Si la categoría cambió
  // de slug entre el `nextAvailableSuffix` y el `create`, el `@@unique` nos
  // protege (reintentamos con el siguiente sufijo).
  const variantPlans = parsed.data.variants.map((v) => {
    const suffix = nextAvailableSuffix(
      codeList,
      prefix,
      category.slug,
      v.color ?? null,
    );
    const code = buildVariantCode(prefix, category.slug, v.color ?? null, suffix);
    codeList.push(code);
    return { input: v, code, suffix };
  });

  let productId: string | null = null;
  try {
    const created = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          categoryId: parsed.data.categoryId,
        },
      });
      productId = product.id;

      for (const plan of variantPlans) {
        let attempt = 0;
        let candidate = plan.code;
        let succeeded = false;
        while (attempt < MAX_ATTEMPTS) {
          try {
            const createdVariant = await tx.productVariant.create({
              data: {
                productId: product.id,
                code: candidate,
                color: plan.input.color ?? null,
                material: plan.input.material ?? null,
                size: plan.input.size ?? null,
                price: plan.input.price as string,
                cost: (plan.input.cost ?? null) as string | null,
                stock: plan.input.stock,
                reservedStock: 0,
                soldStock: 0,
                barcode: plan.input.barcode ?? null,
              },
              select: { id: true },
            });
            if (plan.input.stock > 0) {
              await tx.inventoryMovement.create({
                data: {
                  variantId: createdVariant.id,
                  type: "IN",
                  quantity: plan.input.stock,
                  reason: "Stock inicial",
                },
              });
            }
            succeeded = true;
            break;
          } catch (error) {
            if (
              error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === "P2002"
            ) {
              plan.suffix += 1;
              candidate = buildVariantCode(
                prefix,
                category.slug,
                plan.input.color ?? null,
                plan.suffix,
              );
              attempt += 1;
              continue;
            }
            throw error;
          }
        }
        if (!succeeded) {
          throw new Error(
            "No se pudo generar un código único para una variante.",
          );
        }
      }

      if (uploadedImage) {
        await tx.productImage.create({
          data: {
            url: uploadedImage.url,
            pathname: uploadedImage.pathname,
            productId: product.id,
            variantId: null,
            isPrimary: true,
          },
        });
      }

      return product;
    });
    productId = created.id;
  } catch (error) {
    // Compensar el blob subido si la transacción falla.
    if (uploadedImage) {
      await deleteImage(uploadedImage.pathname).catch(() => {
        // El fallo de limpieza se ignora: preferimos un blob huérfano a
        // un error de acción que ya reportó el problema real.
      });
    }
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "No pudimos crear el producto. Intenta nuevamente.",
      code: "CREATE_FAILED",
    };
  }

  const user = await getCurrentUser();
  auditAfter(user?.id ?? null, {
    action: "PRODUCT_CREATED",
    entity: "Product",
    entityId: productId!,
    metadata: {
      name: parsed.data.name,
      categoryId: parsed.data.categoryId,
      hasVariants: parsed.data.hasVariants,
      variantCount: parsed.data.variants.length,
      hasImage: Boolean(uploadedImage),
    },
  });

  revalidatePath("/productos");
  revalidatePath(`/productos/${productId}`);
  redirect(`/productos/${productId}`);
}

export async function updateProductAction(
  productId: string,
  _prev: ProductActionResult | undefined,
  formData: FormData,
): Promise<ProductActionResult> {
  await requireRole(["ADMIN", "SELLER"]);
  if (!productId) return { ok: false, message: "Falta el identificador." };

  const parsed = ProductUpdateSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los datos del formulario.",
      fieldErrors: fieldErrors<keyof ProductCreateInput>(parsed.error.issues),
    };
  }

  const prisma = getPrisma();
  const existing = await prisma.product.findUnique({ where: { id: productId } });
  if (!existing) return { ok: false, message: "El producto ya no existe." };

  await prisma.product.update({
    where: { id: productId },
    data: {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      categoryId: parsed.data.categoryId,
      ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
    },
  });
  revalidatePath("/productos");
  revalidatePath(`/productos/${productId}`);
  redirect(`/productos/${productId}`);
}

export async function setProductActiveAction(
  productId: string,
  isActive: boolean,
): Promise<void> {
  await requireRole(["ADMIN", "SELLER"]);
  if (!productId) return;
  const prisma = getPrisma();
  await prisma.product.update({
    where: { id: productId },
    data: { isActive },
  });
  revalidatePath("/productos");
  revalidatePath(`/productos/${productId}`);
}

export async function searchProductsAction(
  query: string,
  page = 1,
  perPage = 20,
  categoryId?: string,
) {
  await requireRole(["ADMIN", "SELLER"]);
  const safePage = Math.max(1, Math.floor(page));
  const safePerPage = Math.min(100, Math.max(1, Math.floor(perPage)));
  const trimmed = query.trim();

  const prisma = getPrisma();
  const where: Prisma.ProductWhereInput = {
    isActive: true,
    ...(categoryId ? { categoryId } : {}),
    ...(trimmed
      ? {
          OR: [
            { name: { contains: trimmed, mode: "insensitive" } },
            { variants: { some: { code: { contains: trimmed, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safePerPage,
      take: safePerPage,
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
        category: { select: { id: true, name: true, slug: true } },
        _count: { select: { variants: true } },
      },
    }),
  ]);

  return {
    items: products,
    total,
    page: safePage,
    perPage: safePerPage,
    query: trimmed,
  };
}

export type ProductListItem = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  category: { id: string; name: string; slug: string } | null;
  variantCount: number;
};

// =====================================================================
// Variants
// =====================================================================

export async function createVariantAction(
  productId: string,
  _prev: VariantActionResult | undefined,
  formData: FormData,
): Promise<VariantActionResult> {
  await requireRole(["ADMIN", "SELLER"]);
  if (!productId) return { ok: false, message: "Falta el producto." };

  const raw = {
    productId,
    color: String(formData.get("color") ?? "").trim(),
    material: String(formData.get("material") ?? "").trim(),
    size: String(formData.get("size") ?? "").trim(),
    price: String(formData.get("price") ?? "").trim(),
    cost: String(formData.get("cost") ?? "").trim(),
    stock: String(formData.get("stock") ?? "0").trim(),
    barcode: String(formData.get("barcode") ?? "").trim(),
  };
  const parsed = ProductVariantCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los datos del formulario.",
      fieldErrors: fieldErrors<keyof ProductVariantCreateInput>(parsed.error.issues),
    };
  }

  const prisma = getPrisma();
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { category: true },
  });
  if (!product) {
    return { ok: false, message: "El producto ya no existe." };
  }

  const settings = await getSettings();
  const prefix = settings.productCodePrefix;

  const existingCodes = await prisma.productVariant.findMany({
    where: {
      product: { categoryId: product.categoryId },
    },
    select: { code: true },
  });
  const codeList = existingCodes.map((v) => v.code);

  let attempt = 0;
  let lastError: unknown = null;
  while (attempt < MAX_ATTEMPTS) {
    const suffix = nextAvailableSuffix(
      codeList,
      prefix,
      product.category.slug,
      parsed.data.color,
    );
    const candidate = buildVariantCode(
      prefix,
      product.category.slug,
      parsed.data.color,
      suffix,
    );
    try {
      const variant = await prisma.$transaction(async (tx) => {
        const v = await tx.productVariant.create({
          data: {
            productId: product.id,
            code: candidate,
            color: parsed.data.color ?? null,
            material: parsed.data.material ?? null,
            size: parsed.data.size ?? null,
            price: parsed.data.price as string,
            cost: (parsed.data.cost ?? null) as string | null,
            stock: parsed.data.stock,
            reservedStock: 0,
            soldStock: 0,
            barcode: parsed.data.barcode ?? null,
          },
        });
        if (parsed.data.stock > 0) {
          await tx.inventoryMovement.create({
            data: {
              variantId: v.id,
              type: "IN",
              quantity: parsed.data.stock,
              reason: "Stock inicial",
            },
          });
        }
        return v;
      });
      revalidatePath(`/productos/${product.id}`);
      redirect(`/productos/${product.id}`);
      return { ok: true, message: "Variante creada." };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        codeList.push(candidate);
        attempt += 1;
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  void lastError;
  return {
    ok: false,
    message: "No se pudo generar un código único. Intenta nuevamente.",
  };
}

export async function updateVariantAction(
  variantId: string,
  _prev: VariantActionResult | undefined,
  formData: FormData,
): Promise<VariantActionResult> {
  await requireRole(["ADMIN", "SELLER"]);
  if (!variantId) return { ok: false, message: "Falta la variante." };

  const raw = {
    color: String(formData.get("color") ?? "").trim(),
    material: String(formData.get("material") ?? "").trim(),
    size: String(formData.get("size") ?? "").trim(),
    price: String(formData.get("price") ?? "").trim(),
    cost: String(formData.get("cost") ?? "").trim(),
    barcode: String(formData.get("barcode") ?? "").trim(),
    status: formData.get("status") as string | null,
  };
  const parsed = ProductVariantUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los datos del formulario.",
      fieldErrors: fieldErrors<keyof ProductVariantCreateInput>(parsed.error.issues),
    };
  }

  const prisma = getPrisma();
  const existing = await prisma.productVariant.findUnique({
    where: { id: variantId },
  });
  if (!existing) return { ok: false, message: "La variante ya no existe." };

  await prisma.productVariant.update({
    where: { id: variantId },
    data: {
      color: parsed.data.color ?? null,
      material: parsed.data.material ?? null,
      size: parsed.data.size ?? null,
      price: parsed.data.price,
      cost: parsed.data.cost === undefined ? null : parsed.data.cost,
      barcode: parsed.data.barcode ?? null,
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
    },
  });

  const user = await getCurrentUser();
  if (
    existing.price.toString() !== parsed.data.price ||
    (existing.cost?.toString() ?? null) !== (parsed.data.cost ?? null)
  ) {
    auditAfter(user?.id ?? null, {
      action: "PRODUCT_PRICE_CHANGED",
      entity: "ProductVariant",
      entityId: variantId,
      metadata: {
        previousPrice: existing.price.toString(),
        nextPrice: parsed.data.price,
        previousCost: existing.cost?.toString() ?? null,
        nextCost: parsed.data.cost === undefined ? null : parsed.data.cost,
        productId: existing.productId,
      },
    });
  }
  revalidatePath(`/productos/${existing.productId}`);
  redirect(`/productos/${existing.productId}`);
}

export async function setVariantStatusAction(
  variantId: string,
  status: "ACTIVE" | "HIDDEN" | "ARCHIVED",
): Promise<void> {
  await requireRole(["ADMIN", "SELLER"]);
  if (!variantId) return;
  const prisma = getPrisma();
  await prisma.productVariant.update({
    where: { id: variantId },
    data: { status },
  });
  revalidatePath("/productos");
}

// =====================================================================
// Images
// =====================================================================

export async function uploadProductImageAction(
  productId: string,
  variantId: string | null,
  formData: FormData,
): Promise<{ ok: boolean; message?: string; url?: string }> {
  await requireRole(["ADMIN", "SELLER"]);
  if (!productId) return { ok: false, message: "Falta el producto." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Selecciona una imagen." };
  }

  const prisma = getPrisma();
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return { ok: false, message: "El producto ya no existe." };

  const folder = variantId
    ? `products/${productId}/variants/${variantId}`
    : `products/${productId}`;

  try {
    const uploaded = await uploadImage(file, folder, productId);
    const hasPrimary = await prisma.productImage.count({
      where: { productId, isPrimary: true },
    });
    await prisma.productImage.create({
      data: {
        url: uploaded.url,
        pathname: uploaded.pathname,
        productId,
        variantId: variantId ?? null,
        isPrimary: hasPrimary === 0,
      },
    });
    revalidatePath(`/productos/${productId}`);
    return { ok: true, message: "Imagen subida.", url: uploaded.url };
  } catch (error) {
    const message =
      error instanceof ImageUploadError
        ? error.message
        : "No se pudo subir la imagen.";
    return { ok: false, message };
  }
}

export async function setPrimaryImageAction(imageId: string): Promise<void> {
  await requireRole(["ADMIN", "SELLER"]);
  if (!imageId) return;
  const prisma = getPrisma();
  const image = await prisma.productImage.findUnique({ where: { id: imageId } });
  if (!image || !image.productId) return;
  await prisma.$transaction([
    prisma.productImage.updateMany({
      where: { productId: image.productId, NOT: { id: imageId } },
      data: { isPrimary: false },
    }),
    prisma.productImage.update({
      where: { id: imageId },
      data: { isPrimary: true },
    }),
  ]);
  revalidatePath(`/productos/${image.productId}`);
}

export async function deleteImageAction(imageId: string): Promise<void> {
  await requireRole(["ADMIN", "SELLER"]);
  if (!imageId) return;
  const prisma = getPrisma();
  const image = await prisma.productImage.findUnique({ where: { id: imageId } });
  if (!image) return;
  await prisma.productImage.delete({ where: { id: imageId } });
  await deleteImage(image.pathname);
  if (image.productId) revalidatePath(`/productos/${image.productId}`);
}
