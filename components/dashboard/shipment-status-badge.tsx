import { Badge } from "@/components/ui/badge";

type Status = "PENDING" | "PREPARING" | "READY" | "SHIPPED" | "DELIVERED" | "CANCELLED";

const LABEL: Record<Status, string> = {
  PENDING: "Pendiente",
  PREPARING: "Preparando",
  READY: "Listo",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

const VARIANT: Record<
  Status,
  "default" | "secondary" | "outline" | "destructive"
> = {
  PENDING: "secondary",
  PREPARING: "outline",
  READY: "outline",
  SHIPPED: "default",
  DELIVERED: "default",
  CANCELLED: "destructive",
};

const CLASS: Record<Status, string> = {
  PENDING: "bg-amber-500 text-white",
  PREPARING: "bg-purple-500 text-white",
  READY: "bg-blue-500 text-white",
  SHIPPED: "bg-emerald-600 text-white",
  DELIVERED: "bg-emerald-700 text-white",
  CANCELLED: "",
};

export function ShipmentStatusBadge({ status }: { status: Status }) {
  return (
    <Badge variant={VARIANT[status]} className={CLASS[status]}>
      {LABEL[status]}
    </Badge>
  );
}

export const SHIPMENT_STATUS_LABELS = LABEL;
