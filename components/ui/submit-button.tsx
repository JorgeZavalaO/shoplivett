"use client";

import { useFormStatus } from "react-dom";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";

type SubmitButtonProps = {
  label?: string;
  savingLabel?: string;
  className?: string;
};

export function SubmitButton({
  label = "Guardar",
  savingLabel = "Guardando…",
  className,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className={className ?? "min-w-40"}>
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" /> {savingLabel}
        </>
      ) : (
        <>
          <Save className="size-4" /> {label}
        </>
      )}
    </Button>
  );
}
