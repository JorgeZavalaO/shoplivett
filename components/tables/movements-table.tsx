import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MovementTypeBadge } from "@/components/dashboard/movement-type-badge";

export type MovementRow = {
  id: string;
  type: "IN" | "RESERVE" | "RELEASE" | "SALE" | "CANCEL" | "ADJUSTMENT";
  quantity: number;
  reason: string | null;
  createdAt: Date;
};

export function MovementsTable({ items }: { items: MovementRow[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no hay movimientos registrados para esta variante.
      </p>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Cantidad</TableHead>
            <TableHead>Motivo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="text-sm">
                {new Intl.DateTimeFormat("es-PE", {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(new Date(m.createdAt))}
              </TableCell>
              <TableCell>
                <MovementTypeBadge type={m.type} quantity={m.quantity} />
              </TableCell>
              <TableCell className="font-mono text-sm">
                {m.quantity > 0 && m.type !== "IN" && m.type !== "RELEASE"
                  ? `+${m.quantity}`
                  : m.quantity}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {m.reason ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
