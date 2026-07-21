"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2 } from "lucide-react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import type { ImportBatchStatus } from "@prisma/client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { updateBatchStatusAction } from "@/actions/import-batches";
import { IMPORT_BATCH_STATUS_LABELS } from "@/lib/import-batches-shared";

type Props = {
  batchId: string;
  currentStatus: ImportBatchStatus;
};

const STATUS_FLOW: ImportBatchStatus[] = ["PURCHASED", "IN_TRANSIT", "COMPLETE", "CLOSED"];

function ConfirmOverlay({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pending,
  tone,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  pending: boolean;
  tone: "default" | "destructive";
  onConfirm: () => void;
}) {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) popupRef.current?.focus();
  }, [open]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) onOpenChange(false);
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, pending, onOpenChange]);

  if (!open) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={() => !pending && onOpenChange(false)}
      />
      <div
        ref={popupRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        className="fixed top-1/2 left-1/2 z-50 grid w-full max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border border-border bg-popover p-6 text-popover-foreground shadow-lg outline-none animate-in fade-in-0 zoom-in-95"
      >
        <div className="flex flex-col gap-2">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="sm:w-auto"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant={tone === "destructive" ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={pending}
            className="sm:w-auto"
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Procesando…
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </div>
      </div>
    </>,
    document.body,
  );
}

export function BatchStatusActions({ batchId, currentStatus }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<ImportBatchStatus | null>(null);

  const availableStatuses = STATUS_FLOW.filter((s) => s !== currentStatus);

  function handleSelect(status: ImportBatchStatus) {
    setTargetStatus(status);
    setConfirmOpen(true);
  }

  function handleConfirm() {
    if (!targetStatus) return;
    const label = IMPORT_BATCH_STATUS_LABELS[targetStatus];

    startTransition(async () => {
      const result = await updateBatchStatusAction(batchId, targetStatus);
      if (result.ok) {
        toast.success("Estado actualizado", {
          description: `Lote cambiado a "${label}".`,
        });
        setConfirmOpen(false);
        setTargetStatus(null);
        router.refresh();
      } else {
        toast.error("No se pudo cambiar el estado", { description: result.message });
      }
    });
  }

  const isDestructive = targetStatus === "CLOSED";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm" disabled={isPending}>
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ChevronDown className="size-4" />
              )}
              {IMPORT_BATCH_STATUS_LABELS[currentStatus]}
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          {availableStatuses.map((status) => (
            <DropdownMenuItem
              key={status}
              onClick={() => handleSelect(status)}
              variant={status === "CLOSED" ? "destructive" : "default"}
            >
              {IMPORT_BATCH_STATUS_LABELS[status]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmOverlay
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={isDestructive ? "Cerrar lote" : "Cambiar estado"}
        description={
          isDestructive
            ? "Al cerrar el lote ya no podrás editarlo ni modificar sus productos. ¿Estás seguro?"
            : `¿Cambiar el lote a "${targetStatus ? IMPORT_BATCH_STATUS_LABELS[targetStatus] : ""}"?`
        }
        confirmLabel={isPending ? "Cambiando..." : "Cambiar"}
        tone={isDestructive ? "destructive" : "default"}
        pending={isPending}
        onConfirm={handleConfirm}
      />
    </>
  );
}
