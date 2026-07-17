// Helpers de permisos y guards por rol.
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { type Role } from "@/lib/roles";
import { isPaymentValidator } from "@/lib/settings";

export { ROLES, isRole, type Role } from "@/lib/roles";

export async function canValidatePayments(role: Role | undefined): Promise<boolean> {
  if (!role) return false;
  return isPaymentValidator(role);
}

export function canManageConfiguration(role: Role | undefined): boolean {
  return role === "ADMIN";
}

export function canManageShipments(role: Role | undefined): boolean {
  return role === "ADMIN" || role === "DISPATCH";
}

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

/**
 * Devuelve la URL actual para preservarla en el parámetro `from` cuando
 * se redirige al login. Si no hay contexto, devuelve "/dashboard".
 */
async function currentPathOrDashboard(): Promise<string> {
  try {
    const h = await headers();
    const url = h.get("x-pathname") ?? h.get("referer") ?? "/dashboard";
    if (url.startsWith("/") && !url.startsWith("//")) return url;
  } catch {
    // headers() puede no estar disponible en algunos contextos.
  }
  return "/dashboard";
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    const from = await currentPathOrDashboard();
    redirect(`/login?from=${encodeURIComponent(from)}`);
  }
  return user;
}

export async function requireRole(roles: Role | Role[]) {
  const user = await requireUser();
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (!allowed.includes(user.role)) redirect("/dashboard");
  return user;
}

export async function requirePaymentValidator() {
  const user = await requireUser();
  if (!(await canValidatePayments(user.role))) {
    redirect("/dashboard");
  }
  return user;
}
