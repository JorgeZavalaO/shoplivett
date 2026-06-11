import { Badge } from "@/components/ui/badge";

type Status =
  | "PAYMENT_VALIDATION_PENDING"
  | "RESERVED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "CANCELLED"
  | "EXPIRED";

const LABEL: Record<Status, string> = {
  PAYMENT_VALIDATION_PENDING: "Validación pendiente",
  RESERVED: "Reservada",
  PARTIALLY_PAID: "Saldo pendiente",
  PAID: "Pagada",
  CANCELLED: "Cancelada",
  EXPIRED: "Vencida",
};

const VARIANT: Record<Status, "default" | "secondary" | "outline" | "destructive"> = {
  PAYMENT_VALIDATION_PENDING: "secondary",
  RESERVED: "outline",
  PARTIALLY_PAID: "outline",
  PAID: "default",
  CANCELLED: "destructive",
  EXPIRED: "destructive",
};

const CLASS: Record<Status, string> = {
  PAYMENT_VALIDATION_PENDING: "bg-amber-500 text-white",
  RESERVED: "bg-purple-500 text-white",
  PARTIALLY_PAID: "bg-blue-200 text-blue-900",
  PAID: "bg-emerald-600 text-white",
  CANCELLED: "",
  EXPIRED: "",
};

export function OrderStatusBadge({ status }: { status: Status }) {
  return (
    <Badge variant={VARIANT[status]} className={CLASS[status]}>
      {LABEL[status]}
    </Badge>
  );
}

export const ORDER_STATUS_LABELS = LABEL;
