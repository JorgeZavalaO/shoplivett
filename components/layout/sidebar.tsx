"use client";

import { Sparkles } from "lucide-react";

import type { Role } from "@/lib/permissions";
import { SidebarNav } from "@/components/layout/sidebar-nav";

type SidebarProps = {
  role: Role;
};

export function Sidebar({ role }: SidebarProps) {
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
      <SidebarNav role={role} />
      <div className="border-t border-border p-4 text-xs text-muted-foreground">
        Sesión activa · {role}
      </div>
    </aside>
  );
}
