import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default function LivesPage() {
  return (
    <ModulePlaceholder
      title="Sesiones de Live"
      description="Agrupar ventas y analizar resultados por transmisión de TikTok Live."
      sprint="Sprint 6"
      bullets={[
        "Modelo LiveSession",
        "Crear, abrir, cerrar y cancelar live",
        "No permite pedidos en live cerrado",
        "Totales vendido, cobrado y pendiente por live",
      ]}
    />
  );
}
