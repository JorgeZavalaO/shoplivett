import { Badge } from "@/components/ui/badge";

type Status = "ACTIVE" | "FREQUENT" | "RISKY" | "BLOCKED";

const LABEL: Record<Status, string> = {
  ACTIVE: "Activa",
  FREQUENT: "Frecuente",
  RISKY: "Riesgosa",
  BLOCKED: "Bloqueada",
};

const VARIANT: Record<
  Status,
  "default" | "secondary" | "outline" | "destructive"
> = {
  ACTIVE: "default",
  FREQUENT: "secondary",
  RISKY: "outline",
  BLOCKED: "destructive",
};

const CLASS: Record<Status, string> = {
  ACTIVE: "bg-emerald-600 text-white",
  FREQUENT: "bg-blue-600 text-white",
  RISKY: "bg-amber-500 text-white",
  BLOCKED: "",
};

export function CustomerStatusBadge({ status }: { status: Status }) {
  return (
    <Badge variant={VARIANT[status]} className={CLASS[status]}>
      {LABEL[status]}
    </Badge>
  );
}

export const CUSTOMER_STATUS_LABELS = LABEL;
export const CUSTOMER_STATUSES: Status[] = [
  "ACTIVE",
  "FREQUENT",
  "RISKY",
  "BLOCKED",
];
