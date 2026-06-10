import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default function InventarioPage() {
  return (
    <ModulePlaceholder
      title="Inventario"
      description="Stock total, reservado, vendido y disponible por variante."
      sprint="Sprint 5"
      bullets={[
        "Movimientos IN, RESERVE, RELEASE, SALE, CANCEL, ADJUSTMENT",
        "Funciones reserveStock, releaseStock, confirmSaleStock",
        "Historial por variante",
        "Validación de stock disponible",
      ]}
    />
  );
}
