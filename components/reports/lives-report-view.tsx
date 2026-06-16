import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { LivesReport, LiveSalesRow } from "@/lib/reports";

const LIVE_CHANNEL_LABELS: Record<string, string> = {
  TIKTOK: "TikTok",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  WHATSAPP: "WhatsApp",
  OTHER: "Otro",
};

const LIVE_STATUS_LABELS: Record<string, string> = {
  OPEN: "Abierto",
  CLOSED: "Cerrado",
  CANCELLED: "Cancelado",
};

const DATE_FORMATTER = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "short",
  timeStyle: "short",
});

const STATUS_TONE: Record<string, string> = {
  OPEN: "bg-emerald-600 text-white",
  CLOSED: "",
  CANCELLED: "bg-destructive text-white",
};

type Props = {
  data: LivesReport;
};

export function LivesReportView({ data }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Pedidos del rango</CardDescription>
            <CardTitle className="text-2xl">
              {data.totals.ordersCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Total pedidos</CardDescription>
            <CardTitle className="text-2xl">
              S/ {data.totals.pedidosTotal}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Cobrado</CardDescription>
            <CardTitle className="text-2xl text-emerald-600">
              S/ {data.totals.cobradoTotal}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Pendiente</CardDescription>
            <CardTitle className="text-2xl text-amber-600">
              S/ {data.totals.pendienteTotal}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lives</CardTitle>
          <CardDescription>
            {data.total === 0
              ? "No hay lives en el rango."
              : `Mostrando ${data.items.length} de ${data.total} live(s).`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ajusta los filtros para ver resultados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Inicio</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Pedidos</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Cobrado</TableHead>
                    <TableHead>Pendiente</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((l: LiveSalesRow) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {DATE_FORMATTER.format(new Date(l.startedAt))}
                      </TableCell>
                      <TableCell className="font-medium">{l.name}</TableCell>
                      <TableCell className="text-sm">
                        {LIVE_CHANNEL_LABELS[l.channel] ?? l.channel}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={STATUS_TONE[l.status] ?? ""}
                          variant={l.status === "CLOSED" ? "secondary" : "default"}
                        >
                          {LIVE_STATUS_LABELS[l.status] ?? l.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{l.ordersCount}</TableCell>
                      <TableCell className="font-mono text-xs">
                        S/ {l.pedidosTotal}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-emerald-600">
                        S/ {l.cobradoTotal}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-amber-600">
                        S/ {l.pendienteTotal}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/lives/${l.id}`}
                          className="text-xs text-primary hover:underline"
                        >
                          Ver
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
