import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Power, XCircle } from "lucide-react";

import {
  cancelLiveAction,
  getLiveDetailAction,
  closeLiveAction,
} from "@/actions/lives";
import { LiveStatusBadge } from "@/components/dashboard/live-status-badge";
import { LiveSummaryCards } from "@/components/dashboard/live-summary-cards";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

const CHANNEL_LABELS = Object.fromEntries(
  [
    { value: "TIKTOK", label: "TikTok" },
    { value: "INSTAGRAM", label: "Instagram" },
    { value: "FACEBOOK", label: "Facebook" },
    { value: "WHATSAPP", label: "WhatsApp" },
    { value: "OTHER", label: "Otro" },
  ].map((option) => [option.value, option.label]),
) as Record<string, string>;

export default async function LiveDetailPage({ params }: { params: Params }) {
  const { id } = await params;

  let detail;
  try {
    detail = await getLiveDetailAction(id);
  } catch {
    notFound();
  }

  const { live, metrics } = detail;
  const isOpen = live.status === "OPEN";

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2"
            render={
              <Link href="/lives">
                <ArrowLeft className="size-4" /> Lives
              </Link>
            }
          />
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{live.name}</h1>
            <LiveStatusBadge status={live.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {CHANNEL_LABELS[live.channel]}
            {live.responsible
              ? ` · Responsable: ${live.responsible.name ?? live.responsible.email}`
              : " · Sin responsable asignado"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isOpen ? (
            <>
              <Button
                variant="outline"
                render={
                  <Link href={`/lives/${live.id}/editar`}>
                    <Pencil className="size-4" /> Editar
                  </Link>
                }
              />
              <form action={closeLiveAction.bind(null, live.id)}>
                <Button type="submit" variant="outline">
                  <Power className="size-4" /> Cerrar live
                </Button>
              </form>
              <form action={cancelLiveAction.bind(null, live.id)}>
                <Button type="submit" variant="outline" className="text-destructive">
                  <XCircle className="size-4" /> Cancelar
                </Button>
              </form>
            </>
          ) : null}
        </div>
      </div>

      <LiveSummaryCards metrics={metrics} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalle del live</CardTitle>
          <CardDescription>
            Estas métricas y relaciones se completarán automáticamente cuando entren pedidos y pagos.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Canal</p>
            <p>{CHANNEL_LABELS[live.channel]}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Inicio</p>
            <p>
              {new Intl.DateTimeFormat("es-PE", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(live.startedAt))}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cierre</p>
            <p>
              {live.closedAt
                ? new Intl.DateTimeFormat("es-PE", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(live.closedAt))
                : "Aún abierto"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Responsable</p>
            <p>{live.responsible?.name ?? live.responsible?.email ?? "Sin asignar"}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-xs text-muted-foreground">Observaciones</p>
            <p className="whitespace-pre-wrap">
              {live.notes?.trim() || "Sin observaciones."}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
