import type { IncidentType } from "@prisma/client";
import { INCIDENT_TYPE_LABELS } from "@/lib/incidents-shared";

const TYPE_STYLES: Record<IncidentType, string> = {
  RETURN: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  DAMAGE: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  LOSS: "bg-destructive/10 text-destructive",
  CLAIM: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  EXCHANGE: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
};

type Props = {
  type: IncidentType;
};

export function IncidentTypeBadge({ type }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_STYLES[type]}`}
    >
      {INCIDENT_TYPE_LABELS[type]}
    </span>
  );
}
