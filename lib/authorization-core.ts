import { ROLES, type Role } from "@/lib/roles";

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

export function hasPermissionSync(role: Role, permission: Permission): boolean {
  return STATIC_PERMISSION_MATRIX[role].has(permission);
}

export function rolesFor(permission: Permission): Role[] {
  return ROLES.filter((role) => hasPermissionSync(role, permission));
}
