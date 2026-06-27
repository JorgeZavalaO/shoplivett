import type { ExpenseStatus } from "@prisma/client";

const STATUS_LABELS: Record<ExpenseStatus, string> = {
  ACTIVE: "Activo",
  VOIDED: "Anulado",
};

const STATUS_STYLES: Record<ExpenseStatus, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  VOIDED: "bg-muted text-muted-foreground",
};

type Props = {
  status: ExpenseStatus;
};

export function ExpenseStatusBadge({ status }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
