import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function DashboardNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <FileQuestion className="size-12 text-muted-foreground" />
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Recurso no encontrado
        </h1>
        <p className="text-sm text-muted-foreground">
          El registro que buscas ya no existe, fue archivado o no tienes
          acceso.
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
