import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default function VentasPage() {
  return (
    <ModulePlaceholder
      title="Venta rápida"
      description="Registro de ventas durante el live con adelanto obligatorio."
      sprint="Sprint 7"
      bullets={[
        "Selección de live activo",
        "Buscar o crear clienta",
        "Buscar variante por código, nombre o color",
        "Adelanto obligatorio y validación contra configuración",
      ]}
    />
  );
}
