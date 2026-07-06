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

import { requireUser, ROLES, type Role } from "@/lib/permissions";
import { isPaymentValidator } from "@/lib/settings";

export const PERMISSIONS = [
  "dashboard.read",
  "customers.read",
  "customers.write",
  "products.read",
  "products.write",
  "inventory.read",
  "inventory.write",
  "lives.read",
  "lives.write",
  "orders.read",
  "orders.write",
  "orders.expire",
  "payments.read",
  "payments.create",
  "payments.validate",
  "shipments.read",
  "shipments.write",
  "credits.read",
  "credits.write",
  "credits.refund",
  "reports.read",
  "expenses.read",
  "incidents.read",
  "settings.read",
  "settings.write",
  "audit.read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const STATIC_PERMISSION_MATRIX: Record<Role, ReadonlySet<Permission>> = {
  ADMIN: new Set<Permission>(PERMISSIONS),
  SELLER: new Set<Permission>([
    "dashboard.read",
    "customers.read",
    "customers.write",
    "products.read",
    "inventory.read",
    "inventory.write",
    "lives.read",
    "lives.write",
    "orders.read",
    "orders.write",
    "orders.expire",
    "payments.read",
    "payments.create",
    "credits.read",
    "credits.write",
  ]),
  DISPATCH: new Set<Permission>([
    "dashboard.read",
    "products.read",
    "inventory.read",
    "lives.read",
    "shipments.read",
    "shipments.write",
  ]),
};

export async function hasPermission(
  role: Role,
  permission: Permission,
): Promise<boolean> {
  if (STATIC_PERMISSION_MATRIX[role].has(permission)) {
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

export function hasPermissionSync(role: Role, permission: Permission): boolean {
  if (STATIC_PERMISSION_MATRIX[role].has(permission)) return true;
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

export function rolesFor(permission: Permission): Role[] {
  return ROLES.filter((r) => STATIC_PERMISSION_MATRIX[r].has(permission));
}
