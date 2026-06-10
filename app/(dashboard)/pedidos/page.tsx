import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default function PedidosPage() {
  return (
    <ModulePlaceholder
      title="Pedidos"
      description="Listado y gestión de pedidos, reservas y vencimientos."
      sprint="Sprint 7"
      bullets={[
        "Modelos Order y OrderItem",
        "Estados: validación pendiente, reservado, pagado, etc.",
        "Cálculo de saldo y fecha de vencimiento",
        "Reserva de stock al crear pedido",
      ]}
    />
  );
}
