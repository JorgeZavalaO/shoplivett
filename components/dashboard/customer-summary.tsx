import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardDescription>Estado</CardDescription>
          <CardTitle className="flex items-center gap-2 text-base">
            <CustomerStatusBadge status={customer.status} />
            {!customer.isActive ? (
              <span className="text-xs font-normal text-muted-foreground">
                (inactiva)
              </span>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">WhatsApp: </span>
            <span className="font-medium">{whatsappDisplay}</span>
          </p>
          {customer.document ? (
            <p>
              <span className="text-muted-foreground">Documento: </span>
              {customer.document}
            </p>
          ) : null}
          <p>
            <span className="text-muted-foreground">Registrada: </span>
            {registered}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Deuda acumulada</CardDescription>
          <CardTitle className="text-3xl">S/ {debt}</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Suma de saldos pendientes de pedidos activos.
          <br />
          Disponible en Sprint 7.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Crédito disponible</CardDescription>
          <CardTitle className="text-3xl">S/ {credit}</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Créditos activos por sobrepago o devolución.
          <br />
          Disponible en Sprint 9.
        </CardContent>
      </Card>

      {(customer.address || customer.district || customer.reference) && (
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Datos de contacto</CardTitle>
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
