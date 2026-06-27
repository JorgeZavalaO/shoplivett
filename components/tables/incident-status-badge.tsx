import type { IncidentStatus } from "@prisma/client";
import { INCIDENT_STATUS_LABELS } from "@/lib/incidents-shared";

const STATUS_STYLES: Record<IncidentStatus, string> = {
  OPEN: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  RESOLVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  CANCELLED: "bg-muted text-muted-foreground",
};

type Props = {
  status: IncidentStatus;
};

export function IncidentStatusBadge({ status }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {INCIDENT_STATUS_LABELS[status]}
    </span>
  );
}
