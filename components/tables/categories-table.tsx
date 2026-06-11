"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Power, PowerOff, Tag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { setCategoryActiveAction } from "@/actions/categories";

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  productCount: number;
};

export function CategoriesTable({ items }: { items: CategoryRow[] }) {
  const [, startTransition] = useTransition();

  function toggle(id: string, isActive: boolean) {
    startTransition(async () => {
      await setCategoryActiveAction(id, !isActive);
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Productos</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="h-24 text-center text-sm text-muted-foreground"
              >
                Aún no hay categorías.
              </TableCell>
            </TableRow>
          ) : (
            items.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="font-mono text-xs">
                  <span className="inline-flex items-center gap-1">
                    <Tag className="size-3 text-muted-foreground" />
                    {c.slug}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{c.productCount}</Badge>
                </TableCell>
                <TableCell>
                  {c.isActive ? (
                    <Badge className="bg-emerald-600 text-white">Activa</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-500 text-white">
                      Inactiva
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      render={
                        <Link href={`/categorias/${c.id}/editar`}>Editar</Link>
                      }
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggle(c.id, c.isActive)}
                      render={
                        <button type="button" className="flex items-center gap-1">
                          {c.isActive ? (
                            <>
                              <PowerOff className="size-3" /> Desactivar
                            </>
                          ) : (
                            <>
                              <Power className="size-3" /> Activar
                            </>
                          )}
                        </button>
                      }
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
