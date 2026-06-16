import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <FileQuestion className="size-12 text-muted-foreground" />
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Página no encontrada
        </h1>
        <p className="text-sm text-muted-foreground">
          La ruta solicitada no existe o fue movida.
        </p>
      </div>
      <Button
        render={
          <Link href="/dashboard">Volver al dashboard</Link>
        }
      />
    </div>
  );
}
