import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default function ClientesPage() {
  return (
    <ModulePlaceholder
      title="Clientes"
      description="Gestión de clientas, deuda acumulada y crédito disponible."
      sprint="Sprint 3"
      bullets={[
        "Modelo Customer con normalización de WhatsApp",
        "Búsqueda por nombre y teléfono",
        "Indicadores de deuda y crédito",
        "Marcas: activa, frecuente, riesgosa, bloqueada",
      ]}
    />
  );
}
