import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Props = {
  metrics: {
    ordersCount: number;
    soldAmount: string;
    collectedAmount: string;
    pendingAmount: string;
  };
};

export function LiveSummaryCards({ metrics }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader>
          <CardDescription>Pedidos</CardDescription>
          <CardTitle className="text-3xl">{metrics.ordersCount}</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Total de pedidos del live.
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Vendido</CardDescription>
          <CardTitle className="text-3xl">S/ {metrics.soldAmount}</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Suma de los totales.
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Cobrado</CardDescription>
          <CardTitle className="text-3xl text-emerald-600">
            S/ {metrics.collectedAmount}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Pagos validados del live.
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Pendiente</CardDescription>
          <CardTitle className="text-3xl text-amber-600">
            S/ {metrics.pendingAmount}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Saldo por cobrar (validado + pendiente de validación).
        </CardContent>
      </Card>
    </div>
  );
}
