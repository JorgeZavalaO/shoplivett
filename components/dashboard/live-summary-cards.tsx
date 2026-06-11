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
          Se poblará en Sprint 7.
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Vendido</CardDescription>
          <CardTitle className="text-3xl">S/ {metrics.soldAmount}</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Se poblará en Sprint 7.
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Cobrado</CardDescription>
          <CardTitle className="text-3xl">S/ {metrics.collectedAmount}</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Se poblará en Sprint 8.
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Pendiente</CardDescription>
          <CardTitle className="text-3xl">S/ {metrics.pendingAmount}</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Se poblará en Sprint 8.
        </CardContent>
      </Card>
    </div>
  );
}
