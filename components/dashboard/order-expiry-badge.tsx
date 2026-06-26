import { Badge } from "@/components/ui/badge";
import {
  deriveOrderExpiryState,
  formatOrderExpiryState,
  type OrderExpiryState,
} from "@/lib/orders";

type Variant = "default" | "destructive" | "outline" | "secondary";

type Props = {
  expiresAt: Date | string;
  status?: string;
  now?: Date;
  className?: string;
};

function variantFor(state: OrderExpiryState): Variant {
  if (state.isOverdue) return "destructive";
  if (state.isNearExpiry) return "outline";
  return "secondary";
}

export function OrderExpiryBadge({ expiresAt, status, now, className }: Props) {
  const state = deriveOrderExpiryState(expiresAt, { now, status });
  if (!state.isOverdue && !state.isNearExpiry) {
    return null;
  }
  return (
    <Badge variant={variantFor(state)} className={className}>
      {formatOrderExpiryState(state)}
    </Badge>
  );
}
