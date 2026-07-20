"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, DollarSign } from "lucide-react";

import { Button } from "@/components/ui/button";
import { applyVariantPriceAction } from "@/actions/products";

type Props = {
  variantId: string;
  price: number;
};

export function ApplyPriceButton({ variantId, price }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleApply() {
    startTransition(async () => {
      const result = await applyVariantPriceAction(variantId, price.toFixed(2));
      if (result.ok) {
        toast.success("Precio aplicado", {
          description: `S/ ${price.toFixed(2)}`,
        });
        router.refresh();
      } else {
        toast.error("Error", { description: result.message });
      }
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      disabled={isPending}
      onClick={handleApply}
    >
      {isPending ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <DollarSign className="size-3" />
      )}
      S/ {price.toFixed(2)}
    </Button>
  );
}
