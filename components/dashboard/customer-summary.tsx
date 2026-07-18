import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CircleDollarSign, Landmark, MapPin, ReceiptText } from "lucide-react";
import { CustomerStatusBadge } from "@/components/dashboard/customer-status-badge";
import { formatWhatsAppDisplay } from "@/lib/phone";

type SummaryProps = {
  customer: {
    name: string;
    whatsapp: string;
    status: "ACTIVE" | "FREQUENT" | "RISKY" | "BLOCKED";
    isActive: boolean;
    createdAt: Date;
    document: string | null;
    address: string | null;
    district: string | null;
    reference: string | null;
    channel: string | null;
    notes: string | null;
  };
  debt: string;
  credit: string;
};

export function CustomerSummary({ customer, debt, credit }: SummaryProps) {
  const whatsappDisplay = formatWhatsAppDisplay(customer.whatsapp);
  const registered = new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
  }).format(customer.createdAt);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1.5"><ReceiptText className="size-3.5" /> Perfil</CardDescription>
          <CardTitle className="flex items-center gap-2 text-base">
            <CustomerStatusBadge status={customer.status} />
            {!customer.isActive ? (
              <span className="text-xs font-normal text-muted-foreground">
                (inactiva)
              </span>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">WhatsApp</span>
            <span className="font-medium">{whatsappDisplay}</span>
          </p>
          {customer.document ? (
            <p className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Documento</span>
              <span>{customer.document}</span>
            </p>
          ) : null}
          <p className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Registrada</span>
            <span>{registered}</span>
          </p>
        </CardContent>
      </Card>

      <Card className="border-amber-200/80 bg-amber-50/40 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/15">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1.5"><Landmark className="size-3.5" /> Deuda acumulada</CardDescription>
          <CardTitle className="text-3xl tracking-tight">S/ {debt}</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Suma de saldos pendientes de pedidos activos.
        </CardContent>
      </Card>

      <Card className="border-emerald-200/80 bg-emerald-50/40 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/15">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1.5"><CircleDollarSign className="size-3.5" /> Crédito disponible</CardDescription>
          <CardTitle className="text-3xl tracking-tight text-emerald-700 dark:text-emerald-400">S/ {credit}</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Créditos activos por sobrepago, manuales o devoluciones.
        </CardContent>
      </Card>

      {(customer.address || customer.district || customer.reference) && (
        <Card className="border-border/70 shadow-sm lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><MapPin className="size-4 text-muted-foreground" /> Datos de contacto</CardTitle>
            <CardDescription>
              Información opcional de envío.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm md:grid-cols-3">
            {customer.address ? (
              <div>
                <p className="text-xs text-muted-foreground">Dirección</p>
                <p>{customer.address}</p>
              </div>
            ) : null}
            {customer.district ? (
              <div>
                <p className="text-xs text-muted-foreground">Distrito</p>
                <p>{customer.district}</p>
              </div>
            ) : null}
            {customer.reference ? (
              <div>
                <p className="text-xs text-muted-foreground">Referencia</p>
                <p>{customer.reference}</p>
              </div>
            ) : null}
            {customer.channel ? (
              <div>
                <p className="text-xs text-muted-foreground">Canal</p>
                <p>{customer.channel}</p>
              </div>
            ) : null}
            {customer.notes ? (
              <div className="md:col-span-3">
                <p className="text-xs text-muted-foreground">Notas</p>
                <p className="whitespace-pre-wrap">{customer.notes}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
