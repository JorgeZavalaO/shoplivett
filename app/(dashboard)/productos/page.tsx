import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default function ProductosPage() {
  return (
    <ModulePlaceholder
      title="Productos y variantes"
      description="Catálogo interno: categorías, producto base, variantes e imágenes."
      sprint="Sprint 4"
      bullets={[
        "CRUD de categorías",
        "CRUD de producto base y variantes",
        "Subida de imágenes a Vercel Blob",
        "Código autogenerado y campo barcode",
      ]}
    />
  );
}
