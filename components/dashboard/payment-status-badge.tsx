import { Badge } from "@/components/ui/badge";

type Status = "PENDING" | "VALIDATED" | "REJECTED";

const LABEL: Record<Status, string> = {
  PENDING: "Pendiente",
  VALIDATED: "Validado",
  REJECTED: "Rechazado",
};

const VARIANT: Record<Status, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "secondary",
  VALIDATED: "default",
  REJECTED: "destructive",
};

const CLASS: Record<Status, string> = {
  PENDING: "bg-amber-500 text-white",
  VALIDATED: "bg-emerald-600 text-white",
  REJECTED: "",
};

export function PaymentStatusBadge({ status }: { status: Status }) {
  return (
    <Badge variant={VARIANT[status]} className={CLASS[status]}>
      {LABEL[status]}
    </Badge>
  );
}

export const PAYMENT_STATUS_LABELS = LABEL;
