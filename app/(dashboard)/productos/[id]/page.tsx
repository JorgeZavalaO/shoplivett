import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ProductLifecycleActions } from "@/components/forms/product-lifecycle-actions";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";


type Params = Promise<{ id: string }>;
type SearchParams = Promise<{
  tab?: string | string[];
  variantsPage?: string | string[];
  imagesPage?: string | string[];
}>;

const TAB_PAGE_SIZE = 24;

export default async function ProductoDetallePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  await requireRole(["ADMIN", "SELLER"]);
  const { id } = await params;
  const sp = await searchParams;
  const tabRaw = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const variantsPageRaw = Array.isArray(sp.variantsPage) ? sp.variantsPage[0] : sp.variantsPage;
  const imagesPageRaw = Array.isArray(sp.imagesPage) ? sp.imagesPage[0] : sp.imagesPage;
  const tab: "info" | "variantes" | "imagenes" =
    tabRaw === "variantes" || tabRaw === "imagenes" ? tabRaw : "info";
  const variantsPage = Math.max(1, Number(variantsPageRaw ?? "1") || 1);
  const imagesPage = Math.max(1, Number(imagesPageRaw ?? "1") || 1);

  const prisma = getPrisma();
  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      createdAt: true,
      category: true,
      _count: { select: { variants: true, images: true } },
    },
  });
  if (!product) notFound();

  const [variants, images] = await Promise.all([
    tab === "variantes"
      ? prisma.productVariant.findMany({
          where: { productId: id },
          orderBy: { createdAt: "asc" },
          skip: (variantsPage - 1) * TAB_PAGE_SIZE,
          take: TAB_PAGE_SIZE,
          select: {
            id: true,
            code: true,
            color: true,
            material: true,
            size: true,
            stock: true,
            price: true,
            status: true,
          },
        })
      : Promise.resolve([]),
    tab === "imagenes"
      ? prisma.productImage.findMany({
          where: { productId: id },
          orderBy: { createdAt: "asc" },
          skip: (imagesPage - 1) * TAB_PAGE_SIZE,
          take: TAB_PAGE_SIZE,
          select: { id: true, url: true, isPrimary: true },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2"
            render={
              <Link href="/productos">
                <ArrowLeft className="size-4" /> Productos
              </Link>
            }
          />
          <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
          <p className="text-sm text-muted-foreground">
            <Link
              href={`/productos?category=${product.category.id}`}
              className="hover:underline"
            >
              {product.category.name}
            </Link>
            {" · "}
            <code className="font-mono text-xs">{product.category.slug}</code>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            render={
              <Link href={`/productos/${product.id}/editar`}>
                <Pencil className="size-4" /> Editar
              </Link>
              }
            />
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-border">
        <TabLink href={`/productos/${id}?tab=info`} active={tab === "info"}>
          Información
        </TabLink>
        <TabLink href={`/productos/${id}?tab=variantes`} active={tab === "variantes"}>
          Variantes ({product._count.variants})
        </TabLink>
        <TabLink href={`/productos/${id}?tab=imagenes`} active={tab === "imagenes"}>
          Imágenes ({product._count.images})
        </TabLink>
      </div>

      {tab === "info" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Descripción</CardTitle>
          </CardHeader>
          <CardContent>
            {product.description ? (
              <p className="whitespace-pre-wrap text-sm">{product.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Sin descripción.</p>
            )}
            <Separator className="my-4" />
            <div className="grid gap-2 text-sm md:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Categoría</p>
                <p>{product.category.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Estado</p>
                <p>{product.isActive ? "Activo" : "Inactivo"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Creado</p>
                <p>
                  {new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(
                    product.createdAt,
                  )}
                </p>
              </div>
            </div>
            <Separator className="my-4" />
            <ProductLifecycleActions
              productId={product.id}
              productName={product.name}
              isActive={product.isActive}
              images={[]}
              variants={[]}
            />
          </CardContent>
        </Card>
      ) : null}

      {tab === "variantes" ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Variantes</CardTitle>
            <Button
              size="sm"
              render={
                <Link href={`/productos/${id}/variantes/nueva`}>
                  Nueva variante
                </Link>
              }
            />
          </CardHeader>
          <CardContent>
            {product._count.variants === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay variantes. Crea la primera para que el producto sea
                vendible.
              </p>
            ) : (
              <>
                <ProductLifecycleActions
                  productId={product.id}
                  productName={product.name}
                  isActive={product.isActive}
                  images={[]}
                  variants={variants.map((v) => ({
                    id: v.id,
                    status: v.status,
                  }))}
                />
                <div className="mt-4 grid gap-3">
                  {variants.map((v) => (
                  <div
                    key={v.id}
                    className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="grid gap-1">
                      <p className="font-mono text-sm font-semibold">{v.code}</p>
                      <p className="text-xs text-muted-foreground">
                        {[v.color, v.material, v.size].filter(Boolean).join(" · ") || "—"}
                        {" · Stock: "}
                        <span className="font-medium text-foreground">{v.stock}</span>
                        {" · Precio: S/ "}
                        <span className="font-medium text-foreground">
                          {v.price.toString()}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        render={
                          <Link href={`/productos/${id}/variantes/${v.id}/editar`}>
                            <Pencil className="size-4" />
                          </Link>
                        }
                      />
                    </div>
                  </div>
                  ))}
                </div>
                <TabPagination
                  page={variantsPage}
                  perPage={TAB_PAGE_SIZE}
                  total={product._count.variants}
                  buildHref={(next) =>
                    `/productos/${id}?tab=variantes${next > 1 ? `&variantsPage=${next}` : ""}`
                  }
                />
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {tab === "imagenes" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Imágenes del producto</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground">
              La primera imagen subida queda como principal. Puedes cambiarla
              desde cada tarjeta.
            </p>
            {product._count.images === 0 ? (
              <p className="text-sm text-muted-foreground">Sin imágenes aún.</p>
            ) : (
              <>
                <ProductLifecycleActions
                  productId={product.id}
                  productName={product.name}
                  isActive={product.isActive}
                  images={images.map((i) => ({ id: i.id, url: i.url, isPrimary: i.isPrimary }))}
                  variants={[]}
                />
                <TabPagination
                  page={imagesPage}
                  perPage={TAB_PAGE_SIZE}
                  total={product._count.images}
                  buildHref={(next) =>
                    `/productos/${id}?tab=imagenes${next > 1 ? `&imagesPage=${next}` : ""}`
                  }
                />
              </>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function TabPagination({
  page,
  perPage,
  total,
  buildHref,
}: {
  page: number;
  perPage: number;
  total: number;
  buildHref: (page: number) => string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  if (total <= perPage) return null;

  return (
    <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
      <span>
        Página {page} de {totalPages}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button size="sm" variant="outline" render={<Link href={buildHref(page - 1)}>Anterior</Link>} />
        ) : null}
        {page < totalPages ? (
          <Button size="sm" variant="outline" render={<Link href={buildHref(page + 1)}>Siguiente</Link>} />
        ) : null}
      </div>
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
