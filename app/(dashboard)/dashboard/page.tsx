import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Boxes,
  CreditCard,
  Package,
  Radio,
  ReceiptText,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";

import { requireUser } from "@/lib/permissions";
import { canManageConfiguration, canValidatePayments } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const ROADMAP = [
  { label: "Sprint 0", name: "Base técnica", state: "Completado" },
  { label: "Sprint 1", name: "Auth y roles", state: "Completado" },
  { label: "Sprint 2", name: "Configuración", state: "Pendiente" },
  { label: "Sprint 3", name: "Clientes", state: "Pendiente" },
  { label: "Sprint 4", name: "Productos y variantes", state: "Pendiente" },
];

const MODULES = [
  { name: "Clientes", icon: Users },
  { name: "Productos", icon: Package },
  { name: "Inventario", icon: Boxes },
  { name: "Lives", icon: Radio },
  { name: "Venta rápida", icon: ShoppingCart },
  { name: "Pedidos", icon: ReceiptText },
  { name: "Pagos", icon: CreditCard },
  { name: "Envíos", icon: Truck },
];

export default async function DashboardPage() {
  const user = await requireUser();
  const displayName = user.name?.trim() || user.email || "usuario";

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Hola, {displayName}
          </h1>
          <Badge>{user.role}</Badge>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Estás autenticado. Las métricas operativas del dashboard se
          implementarán en el Sprint 11.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Permisos del rol</CardDescription>
            <CardTitle className="text-base">
              {canValidatePayments(user.role)
                ? "Puede validar pagos"
                : "No valida pagos"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Configurable desde Configuración (Sprint 2).
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Configuración</CardDescription>
            <CardTitle className="text-base">
              {canManageConfiguration(user.role)
                ? "Acceso total"
                : "Solo lectura"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Reservado a administradores.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Pedidos del día</CardDescription>
            <CardTitle className="text-3xl">—</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Disponible en Sprint 11
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Sesión</CardDescription>
            <CardTitle className="text-base">Activa</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            ID: {user.id.slice(0, 8)}…
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Módulos del sistema</CardTitle>
            <CardDescription>
              El sidebar muestra los módulos permitidos para tu rol.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {MODULES.map(({ name, icon: Icon }) => (
                <div
                  key={name}
                  className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
                >
                  <Icon className="size-4 text-muted-foreground" />
                  {name}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hoja de ruta</CardTitle>
            <CardDescription>Estado de los próximos sprints.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {ROADMAP.map((s) => (
              <div key={s.label} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
                <Badge
                  variant={s.state === "Completado" ? "default" : "secondary"}
                >
                  {s.state}
                </Badge>
              </div>
            ))}
            <Separator className="my-2" />
            <p className="text-xs text-muted-foreground">
              Antes de ventas y pagos, el plan exige estabilizar Config,
              Clientes, Productos/Variantes e Inventario por variante.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
