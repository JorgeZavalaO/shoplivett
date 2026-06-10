import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default function ConfiguracionPage() {
  return (
    <ModulePlaceholder
      title="Configuración del negocio"
      description="Reglas operativas centralizadas y editables."
      sprint="Sprint 2"
      bullets={[
        "Días de reserva y adelanto mínimo",
        "Moneda y prefijos de código de producto",
        "Roles que validan pagos",
        "Medios de pago y envío habilitados",
      ]}
    />
  );
}
