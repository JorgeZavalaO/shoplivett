"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <AlertTriangle className="size-10 text-destructive" />
      <h1 className="text-xl font-semibold">No se pudo cargar esta vista</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Reintenta la acción. Si el problema persiste, contacta al administrador.
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-muted-foreground">
          Código: {error.digest}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button onClick={reset}>Reintentar</Button>
        <Button variant="outline" render={<Link href="/dashboard">Volver al inicio</Link>} />
      </div>
    </div>
  );
}
