"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  useEffect(() => {
    console.error(error);
  }, [error]);

  const context = pathname.startsWith("/reportes")
    ? {
        title: "No se pudo cargar el reporte",
        description: "Reintenta con un rango más acotado o vuelve a la vista de reportes.",
        href: "/reportes",
        cta: "Volver a reportes",
      }
    : pathname.startsWith("/envios")
      ? {
          title: "No se pudo cargar el módulo de envíos",
          description: "Reintenta la operación o vuelve al listado de envíos para continuar con despacho.",
          href: "/envios",
          cta: "Volver a envíos",
        }
      : pathname.startsWith("/inventario")
        ? {
            title: "No se pudo cargar inventario",
            description: "Reintenta la acción. Si ibas a ajustar stock, revisa el detalle de la variante nuevamente.",
            href: "/inventario",
            cta: "Volver a inventario",
          }
        : {
            title: "No se pudo cargar esta vista",
            description: "Reintenta la acción. Si el problema persiste, contacta al administrador.",
            href: "/dashboard",
            cta: "Volver al inicio",
          };

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <AlertTriangle className="size-10 text-destructive" />
      <h1 className="text-xl font-semibold">{context.title}</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {context.description}
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-muted-foreground">
          Código: {error.digest}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button onClick={reset}>Reintentar</Button>
        <Button variant="outline" render={<Link href={context.href}>{context.cta}</Link>} />
      </div>
    </div>
  );
}
