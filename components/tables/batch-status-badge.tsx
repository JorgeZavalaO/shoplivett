import type { ImportBatchStatus } from "@prisma/client";
import { IMPORT_BATCH_STATUS_LABELS } from "@/lib/import-batches-shared";

type Props = {
  status: ImportBatchStatus;
};

const STATUS_STYLES: Record<ImportBatchStatus, string> = {
  PURCHASED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  IN_TRANSIT: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  COMPLETE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  CLOSED: "bg-muted text-muted-foreground",
};

export function BatchStatusBadge({ status }: Props) {
  return (
    <span
      className={
        `inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`
      }
    >
      {IMPORT_BATCH_STATUS_LABELS[status]}
    </span>
  );
}
