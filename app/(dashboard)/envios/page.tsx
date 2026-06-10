import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default function EnviosPage() {
  return (
    <ModulePlaceholder
      title="Envíos agrupados"
      description="Agrupa varios pedidos pagados de una misma clienta en un solo envío."
      sprint="Sprint 10"
      bullets={[
        "Modelos Shipment y ShipmentOrder",
        "Delivery propio, Olva, Shalom, motorizado o recojo",
        "Cálculo de envío gratis según configuración",
        "Estados: enviado, entregado",
      ]}
    />
  );
}
