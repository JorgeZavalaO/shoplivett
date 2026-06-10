import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </div>
          <CardTitle>Shoplivett</CardTitle>
          <CardDescription>
            Accede para gestionar ventas, pagos y envíos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Correo
              </label>
              <Input
                id="email"
                type="email"
                placeholder="admin@shoplivett.com"
                disabled
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                Contraseña
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                disabled
              />
            </div>
            <Button type="button" disabled className="mt-2">
              Iniciar sesión (Sprint 1)
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
