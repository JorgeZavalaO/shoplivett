import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, Plus, RefreshCcw, Repeat, X } from "lucide-react";

type Type = "IN" | "RESERVE" | "RELEASE" | "SALE" | "CANCEL" | "ADJUSTMENT";

const LABEL: Record<Type, string> = {
  IN: "Ingreso",
  RESERVE: "Reserva",
  RELEASE: "Liberación",
  SALE: "Venta",
  CANCEL: "Cancelación",
  ADJUSTMENT: "Ajuste",
};

const VARIANT: Record<
  Type,
  "default" | "secondary" | "outline" | "destructive"
> = {
  IN: "default",
  RESERVE: "secondary",
  RELEASE: "secondary",
  SALE: "default",
  CANCEL: "destructive",
  ADJUSTMENT: "outline",
};

const CLASS: Record<Type, string> = {
  IN: "bg-emerald-600 text-white",
  RESERVE: "bg-amber-500 text-white",
  RELEASE: "bg-amber-200 text-amber-900",
  SALE: "bg-blue-600 text-white",
  CANCEL: "bg-red-600 text-white",
  ADJUSTMENT: "bg-zinc-600 text-white",
};

const ICON: Record<Type, React.ComponentType<{ className?: string }>> = {
  IN: Plus,
  RESERVE: LockIcon,
  RELEASE: Repeat,
  SALE: ArrowDown,
  CANCEL: X,
  ADJUSTMENT: ArrowUp,
};

// Stub para evitar import circular
function LockIcon({ className }: { className?: string }) {
  return <RefreshCcw className={className} />;
}

export function MovementTypeBadge({
  type,
  quantity,
}: {
  type: Type;
  quantity: number;
}) {
  const Icon = ICON[type];
  const sign = type === "IN" || type === "RELEASE" ? "+" : type === "CANCEL" || type === "ADJUSTMENT" && quantity < 0 ? "" : type === "SALE" || type === "RESERVE" ? "-" : "";
  return (
    <Badge variant={VARIANT[type]} className={CLASS[type]}>
      <Icon className="mr-1 size-3" />
      {LABEL[type]} {sign}
      {Math.abs(quantity)}
    </Badge>
  );
}

export const MOVEMENT_TYPE_LABELS = LABEL;
export const MOVEMENT_TYPES: Type[] = [
  "IN",
  "RESERVE",
  "RELEASE",
  "SALE",
  "CANCEL",
  "ADJUSTMENT",
];
