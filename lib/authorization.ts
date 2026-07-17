// Capa de permisos por acción.
//
// Esta capa coexiste con `lib/permissions.ts` (que es por rol) y aporta una
// vista por permiso para crecer sin reescribir todos los guards. Por ahora
// no se usa en producción, pero cualquier nueva página/action puede empezar
// con `assertPermission("payments.validate")` en lugar de `requireRole([...])`.
//
// Los permisos se resuelven siempre desde el rol del usuario. Más adelante
// este módulo se puede ampliar con overrides por usuario o por customer.

import { redirect } from "next/navigation";

import { hasPermissionSync, type Permission } from "@/lib/authorization-core";
import { requireUser } from "@/lib/permissions";
import type { Role } from "@/lib/roles";
import { isPaymentValidator } from "@/lib/settings";

export async function hasPermission(
  role: Role,
  permission: Permission,
): Promise<boolean> {
  if (hasPermissionSync(role, permission)) {
    if (permission === "payments.validate") {
      return isPaymentValidator(role);
    }
    return true;
  }
  if (permission === "payments.validate") {
    return isPaymentValidator(role);
  }
  return false;
}

export async function assertPermission(
  role: Role | undefined,
  permission: Permission,
): Promise<void> {
  if (!role || !(await hasPermission(role, permission))) {
    redirect("/dashboard");
  }
}

export async function requirePermission(permission: Permission) {
  const user = await requireUser();
  if (!(await hasPermission(user.role, permission))) {
    redirect("/dashboard");
  }
  return user;
}
