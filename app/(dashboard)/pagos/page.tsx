import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default function PagosPage() {
  return (
    <ModulePlaceholder
      title="Pagos"
      description="Pagos manuales, capturas y aplicación a pedidos."
      sprint="Sprint 8"
      bullets={[
        "Modelos Payment, PaymentReceipt, PaymentApplication",
        "Subida múltiple de capturas a Vercel Blob",
        "Validar y rechazar pagos",
        "Aplicar pago a uno o varios pedidos",
      ]}
    />
  );
}
