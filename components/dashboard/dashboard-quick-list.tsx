import Link from "next/link";
import type { Route } from "next";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ShipmentStatusBadge } from "@/components/dashboard/shipment-status-badge";
import { PaymentStatusBadge } from "@/components/dashboard/payment-status-badge";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { WhatsAppQuickButton } from "@/components/whatsapp/whatsapp-actions";

export type DashboardQuickItem = {
  id: string;
  title: string;
  subtitle?: string;
  badge?:
    | { kind: "payment"; status: "PENDING" | "VALIDATED" | "REJECTED" }
    | { kind: "order"; status: "PAYMENT_VALIDATION_PENDING" | "RESERVED" | "PARTIALLY_PAID" | "PAID" | "CANCELLED" | "EXPIRED" }
    | { kind: "shipment"; status: "PENDING" | "PREPARING" | "READY" | "SHIPPED" | "DELIVERED" | "CANCELLED" }
    | { kind: "text"; label: string };
  meta?: string;
  href: Route;
  whatsapp?: { name: string; phone: string } | null;
};

type Props = {
  title: string;
  description?: string;
  emptyLabel: string;
  items: DashboardQuickItem[];
  viewAllHref?: Route;
  viewAllLabel?: string;
};

export function DashboardQuickList({
  title,
  description,
  emptyLabel,
  items,
  viewAllHref,
  viewAllLabel,
}: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : null}
        </div>
        {viewAllHref ? (
          <Link
            href={viewAllHref}
            className="text-xs text-muted-foreground hover:underline"
          >
            {viewAllLabel ?? "Ver todos"}
          </Link>
        ) : null}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((it) => (
              <div
                key={it.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-muted"
              >
                <Link
                  href={it.href}
                  className="flex flex-1 items-center justify-between gap-2 min-w-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{it.title}</p>
                    {it.subtitle ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {it.subtitle}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {it.meta ? (
                      <span className="text-muted-foreground">{it.meta}</span>
                    ) : null}
                    {renderBadge(it.badge)}
                  </div>
                </Link>
                {it.whatsapp ? (
                  <WhatsAppQuickButton
                    customer={{
                      name: it.whatsapp.name,
                      whatsapp: it.whatsapp.phone,
                    }}
                  />
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function renderBadge(
  badge: DashboardQuickItem["badge"],
) {
  if (!badge) return null;
  if (badge.kind === "payment") return <PaymentStatusBadge status={badge.status} />;
  if (badge.kind === "order") return <OrderStatusBadge status={badge.status} />;
  if (badge.kind === "shipment") return <ShipmentStatusBadge status={badge.status} />;
  return <Badge variant="outline">{badge.label}</Badge>;
}
