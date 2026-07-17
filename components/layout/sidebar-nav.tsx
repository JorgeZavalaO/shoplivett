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
  ShieldCheck,
  Settings,
  AlertTriangle,
  Layers,
  Wallet,
  AlertOctagon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { hasPermissionSync, type Permission } from "@/lib/authorization-core";
import type { Role } from "@/lib/roles";

type NavItem = {
  href: Route;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  module: string;
  permission?: Permission;
  roles?: Role[];
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, module: "Sprint 11", permission: "dashboard.read" },
  { href: "/clientes", label: "Clientes", icon: Users, module: "Sprint 3", permission: "customers.read" },
  { href: "/productos", label: "Productos", icon: Package, module: "Sprint 4", permission: "products.read" },
  { href: "/inventario", label: "Inventario", icon: Boxes, module: "Sprint 5", permission: "inventory.read" },
  { href: "/lives", label: "Lives", icon: Radio, module: "Sprint 6", permission: "lives.read" },
  { href: "/ventas", label: "Venta rápida", icon: ShoppingCart, module: "Sprint 7", permission: "orders.write" },
  { href: "/pedidos", label: "Pedidos", icon: ReceiptText, module: "Sprint 7", permission: "orders.read" },
  { href: "/pedidos/vencidos", label: "Reservas vencidas", icon: AlertTriangle, module: "Sprint 9", permission: "orders.expire" },
  { href: "/pagos", label: "Pagos", icon: CreditCard, module: "Sprint 8", permission: "payments.read" },
  { href: "/envios", label: "Envíos", icon: Truck, module: "Sprint 10", permission: "shipments.read" },
  { href: "/reportes", label: "Reportes", icon: BarChart3, module: "Sprint 13", permission: "reports.read" },
  { href: "/auditoria", label: "Auditoría", icon: ShieldCheck, module: "Sprint 14", permission: "audit.read" },
  { href: "/lotes", label: "Lotes", icon: Layers, module: "Sprint 19", permission: "inventory.write" },
  { href: "/gastos", label: "Gastos", icon: Wallet, module: "Sprint 22", permission: "expenses.read" },
  { href: "/incidencias", label: "Incidencias", icon: AlertOctagon, module: "Sprint 23", permission: "incidents.read" },
  { href: "/configuracion", label: "Configuración", icon: Settings, module: "Sprint 2", permission: "settings.write" },
];

function isAllowed(role: Role, item: NavItem) {
  if (item.permission) return hasPermissionSync(role, item.permission);
  return item.roles?.includes(role) ?? false;
}

export function SidebarNav({ role, mobile = false }: { role: Role; mobile?: boolean }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => isAllowed(role, item));

  return (
    <nav className={cn("flex-1 overflow-y-auto px-3 py-4", mobile && "px-4") }>
      <ul className="flex flex-col gap-1">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
  );
}
