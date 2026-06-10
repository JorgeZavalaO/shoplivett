import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default function ReportesPage() {
  return (
    <ModulePlaceholder
      title="Reportes"
      description="Reportes básicos para seguimiento comercial y operativo."
      sprint="Sprint 13"
      bullets={[
        "Ventas por día y por live",
        "Pagos por estado",
        "Saldos pendientes y créditos disponibles",
        "Productos más vendidos y clientes frecuentes",
      ]}
    />
  );
}
