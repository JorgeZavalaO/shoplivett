"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import {
  LayoutDashboard,
  Users,
  Package,
  Boxes,
  Radio,
  ShoppingCart,
  ReceiptText,
  CreditCard,
  Truck,
  BarChart3,
  Settings,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { Role } from "@/lib/permissions";

type NavItem = {
  href: Route;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  module: string;
  roles: Role[];
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, module: "Sprint 11", roles: ["ADMIN", "SELLER", "DISPATCH"] },
  { href: "/clientes", label: "Clientes", icon: Users, module: "Sprint 3", roles: ["ADMIN", "SELLER"] },
  { href: "/productos", label: "Productos", icon: Package, module: "Sprint 4", roles: ["ADMIN", "SELLER"] },
  { href: "/inventario", label: "Inventario", icon: Boxes, module: "Sprint 5", roles: ["ADMIN", "SELLER"] },
  { href: "/lives", label: "Lives", icon: Radio, module: "Sprint 6", roles: ["ADMIN", "SELLER"] },
  { href: "/ventas", label: "Venta rápida", icon: ShoppingCart, module: "Sprint 7", roles: ["ADMIN", "SELLER"] },
  { href: "/pedidos", label: "Pedidos", icon: ReceiptText, module: "Sprint 7", roles: ["ADMIN", "SELLER"] },
  { href: "/pagos", label: "Pagos", icon: CreditCard, module: "Sprint 8", roles: ["ADMIN", "SELLER"] },
  { href: "/envios", label: "Envíos", icon: Truck, module: "Sprint 10", roles: ["ADMIN", "DISPATCH"] },
  { href: "/reportes", label: "Reportes", icon: BarChart3, module: "Sprint 13", roles: ["ADMIN"] },
  { href: "/configuracion", label: "Configuración", icon: Settings, module: "Sprint 2", roles: ["ADMIN"] },
];

type SidebarProps = {
  role: Role;
};

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Sparkles className="size-4" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Shoplivett</p>
          <p className="text-xs text-muted-foreground">Admin de ventas</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  <span className="flex-1">{item.label}</span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                    {item.module}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-border p-4 text-xs text-muted-foreground">
        Sesión activa · {role}
      </div>
    </aside>
  );
}
