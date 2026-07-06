"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function GlobalError({
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

  const context = pathname.startsWith("/login")
    ? {
        title: "No se pudo completar el acceso",
        description: "Reintenta iniciar sesión. Si el problema persiste, verifica tus credenciales o la disponibilidad del servidor.",
        href: "/login",
        cta: "Volver al login",
      }
    : {
        title: "Algo salió mal",
        description: "Ocurrió un error inesperado. Intenta de nuevo o vuelve al inicio.",
        href: "/dashboard",
        cta: "Ir al inicio",
      };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
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
