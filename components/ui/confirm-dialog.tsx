"use client"

import * as React from "react"
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type ConfirmTone = "default" | "destructive"

type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: ConfirmTone
  pending?: boolean
  onConfirm: () => void | Promise<void>
  trigger?: React.ReactNode
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "default",
  pending = false,
  onConfirm,
  trigger,
}: ConfirmDialogProps) {
  return (
    <AlertDialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (pending) return
        onOpenChange(next)
      }}
    >
      {trigger ? (
        <AlertDialogPrimitive.Trigger
          data-slot="confirm-dialog-trigger"
          render={trigger as React.ReactElement}
        />
      ) : null}
      <AlertDialogPrimitive.Portal data-slot="confirm-dialog-portal">
        <AlertDialogPrimitive.Backdrop
          data-slot="confirm-dialog-backdrop"
          className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs"
        />
        <AlertDialogPrimitive.Popup
          data-slot="confirm-dialog-popup"
          className={cn(
            "fixed top-1/2 left-1/2 z-50 grid w-full max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border border-border bg-popover p-6 text-popover-foreground shadow-lg outline-none",
            "transition duration-150 ease-out data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
          )}
        >
          <div className="flex flex-col gap-2">
            <AlertDialogPrimitive.Title
              data-slot="confirm-dialog-title"
              className="text-base font-semibold text-foreground"
            >
              {title}
            </AlertDialogPrimitive.Title>
            {description ? (
              <AlertDialogPrimitive.Description
                data-slot="confirm-dialog-description"
                className="text-sm text-muted-foreground"
              >
                {description}
              </AlertDialogPrimitive.Description>
            ) : null}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogPrimitive.Close
              data-slot="confirm-dialog-cancel"
              render={
                <Button
                  type="button"
                  variant="outline"
                  className="sm:w-auto"
                  disabled={pending}
                />
              }
            >
              {cancelLabel}
            </AlertDialogPrimitive.Close>
            <Button
              type="button"
              variant={tone === "destructive" ? "destructive" : "default"}
              onClick={() => {
                void onConfirm()
              }}
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
        </AlertDialogPrimitive.Popup>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  )
}

export { ConfirmDialog }
export type { ConfirmDialogProps, ConfirmTone }
