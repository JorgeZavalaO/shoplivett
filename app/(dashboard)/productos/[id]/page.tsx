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
type SearchParams = Promise<{ tab?: string | string[] }>;

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
  const tab: "info" | "variantes" | "imagenes" =
    tabRaw === "variantes" || tabRaw === "imagenes" ? tabRaw : "info";

  const prisma = getPrisma();
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      variants: {
        orderBy: { createdAt: "asc" },
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
      },
      images: {
        orderBy: { createdAt: "asc" },
        select: { id: true, url: true, isPrimary: true },
      },
    },
  });
  if (!product) notFound();

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
          <ProductLifecycleActions
            productId={product.id}
            productName={product.name}
            isActive={product.isActive}
            images={product.images.map((i) => ({
              id: i.id,
              url: i.url,
              isPrimary: i.isPrimary,
            }))}
            variants={product.variants.map((v) => ({
              id: v.id,
              status: v.status,
            }))}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-border">
        <TabLink href={`/productos/${id}?tab=info`} active={tab === "info"}>
          Información
        </TabLink>
        <TabLink href={`/productos/${id}?tab=variantes`} active={tab === "variantes"}>
          Variantes ({product.variants.length})
        </TabLink>
        <TabLink href={`/productos/${id}?tab=imagenes`} active={tab === "imagenes"}>
          Imágenes ({product.images.length})
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
            {product.variants.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay variantes. Crea la primera para que el producto sea
                vendible.
              </p>
            ) : (
              <div className="grid gap-3">
                {product.variants.map((v) => (
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
            {product.images.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin imágenes aún.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
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
