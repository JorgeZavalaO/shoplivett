// Helpers de permisos por rol. Sprint 1 los conectará con la sesión real.
export const ROLES = ["ADMIN", "SELLER", "DISPATCH"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function canValidatePayments(role: Role | undefined): boolean {
  return role === "ADMIN" || role === "SELLER";
}

export function canManageConfiguration(role: Role | undefined): boolean {
  return role === "ADMIN";
}

export function canManageShipments(role: Role | undefined): boolean {
  return role === "ADMIN" || role === "DISPATCH";
}
