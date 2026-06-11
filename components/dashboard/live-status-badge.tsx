import { Badge } from "@/components/ui/badge";

type Status = "OPEN" | "CLOSED" | "CANCELLED";

const LABEL: Record<Status, string> = {
  OPEN: "Abierto",
  CLOSED: "Cerrado",
  CANCELLED: "Cancelado",
};

const VARIANT: Record<
  Status,
  "default" | "secondary" | "outline" | "destructive"
> = {
  OPEN: "default",
  CLOSED: "secondary",
  CANCELLED: "destructive",
};

const CLASS: Record<Status, string> = {
  OPEN: "bg-emerald-600 text-white",
  CLOSED: "bg-zinc-600 text-white",
  CANCELLED: "",
};

export function LiveStatusBadge({ status }: { status: Status }) {
  return (
    <Badge variant={VARIANT[status]} className={CLASS[status]}>
      {LABEL[status]}
    </Badge>
  );
}

export const LIVE_STATUS_LABELS = LABEL;
