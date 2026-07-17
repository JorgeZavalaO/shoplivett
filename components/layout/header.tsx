"use client";

import { Menu, UserCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Badge } from "@/components/ui/badge";
import { logoutAction } from "@/actions/auth";
import type { Role } from "@/lib/roles";

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrador",
  SELLER: "Vendedora",
  DISPATCH: "Despacho",
};

type HeaderProps = {
  user: { name?: string | null; email?: string | null; role: Role };
};

export function Header({ user }: HeaderProps) {
  const displayName = user.name?.trim() || user.email || "Usuario";
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur md:px-6">
      <Sheet>
        <SheetTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Abrir menú"
            >
              <Menu className="size-5" />
            </Button>
          }
        />
        <SheetContent side="left" className="w-72 p-0">
          <div className="flex h-full flex-col bg-card">
            <div className="border-b border-border px-4 py-4">
              <p className="text-sm font-semibold">Shoplivett</p>
              <p className="text-xs text-muted-foreground">Navegación móvil</p>
            </div>
            <SidebarNav role={user.role} mobile />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">Operación diaria</p>
        <p className="text-xs text-muted-foreground">
          Navega por módulos según tu rol. El buscador global fue retirado hasta tener resultados reales.
        </p>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                className="flex items-center gap-2 px-2"
                aria-label="Cuenta"
              >
                <span className="hidden h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground sm:flex">
                  {initials || <UserCircle2 className="size-5" />}
                </span>
                <div className="hidden flex-col items-start leading-tight sm:flex">
                  <span className="text-sm font-medium">{displayName}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {ROLE_LABEL[user.role]}
                  </span>
                </div>
                <Badge variant="secondary" className="sm:hidden">
                  {user.role}
                </Badge>
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{displayName}</span>
                <span className="text-xs text-muted-foreground">{user.email}</span>
                <Badge variant="secondary" className="mt-1 w-fit">
                  {ROLE_LABEL[user.role]}
                </Badge>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <form action={logoutAction}>
              <DropdownMenuItem render={<button type="submit" className="w-full text-left" />}>
                Cerrar sesión
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
