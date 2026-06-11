import { Badge } from "@/components/ui/badge";

type Status = "ACTIVE" | "HIDDEN" | "ARCHIVED";

const LABEL: Record<Status, string> = {
  ACTIVE: "Activa",
  HIDDEN: "Oculta",
  ARCHIVED: "Archivada",
};

const VARIANT: Record<
  Status,
  "default" | "secondary" | "outline" | "destructive"
> = {
  ACTIVE: "default",
  HIDDEN: "outline",
  ARCHIVED: "secondary",
};

const CLASS: Record<Status, string> = {
  ACTIVE: "bg-emerald-600 text-white",
  HIDDEN: "bg-amber-500 text-white",
  ARCHIVED: "",
};

export function VariantStatusBadge({ status }: { status: Status }) {
  return (
    <Badge variant={VARIANT[status]} className={CLASS[status]}>
      {LABEL[status]}
    </Badge>
  );
}

export const VARIANT_STATUS_LABELS = LABEL;
export const VARIANT_STATUSES: Status[] = ["ACTIVE", "HIDDEN", "ARCHIVED"];
