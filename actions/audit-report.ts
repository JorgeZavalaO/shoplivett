"use server";

import { requireRole } from "@/lib/permissions";
import {
  listAuditActors,
  listAuditLog,
  type AuditLogFilter,
} from "@/lib/audit-report";

export async function listAuditLogAction(filter: AuditLogFilter) {
  await requireRole("ADMIN");
  return listAuditLog(filter);
}

export async function listAuditActorsAction() {
  await requireRole("ADMIN");
  return listAuditActors();
}
