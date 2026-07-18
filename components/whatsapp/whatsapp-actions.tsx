"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, ClipboardCopy, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  buildWhatsappLink,
  buildWhatsappMessage,
  getAvailableTemplates,
  getTemplateDescription,
  getTemplateLabel,
  type AvailableContext,
  type BuildTemplateInput,
  type CustomerContext,
  type OrderContext,
  type OrderTemplateKey,
  type PaymentContext,
  type ShipmentContext,
  type CreditContext,
} from "@/lib/whatsapp";
import { formatWhatsAppDisplay } from "@/lib/phone";

type Variant = "detail" | "inline" | "compact";

type Props = {
  customer: CustomerContext;
  context: AvailableContext;
  order?: OrderContext;
  payment?: PaymentContext;
  shipment?: ShipmentContext;
  credit?: CreditContext;
  defaultTemplate?: OrderTemplateKey;
  variant?: Variant;
  label?: string;
  trigger?: React.ReactElement;
};

function findDefault(
  available: OrderTemplateKey[],
  fallback?: OrderTemplateKey,
): OrderTemplateKey {
  if (fallback && available.includes(fallback)) return fallback;
  if (available.length === 0) return "BALANCE_REMINDER";
  return available[0];
}

export function WhatsAppActions({
  customer,
  context,
  order,
  payment,
  shipment,
  credit,
  defaultTemplate,
  variant = "inline",
  label,
  trigger,
}: Props) {
  const available = useMemo(() => getAvailableTemplates(context), [context]);
  const [selected, setSelected] = useState<OrderTemplateKey>(() =>
    findDefault(available, defaultTemplate),
  );
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  const message = useMemo(() => {
    if (!available.includes(selected)) {
      return "";
    }
    const base: BuildTemplateInput = (() => {
      if (selected === "CREDIT_AVAILABLE" && credit) {
        return { key: "CREDIT_AVAILABLE", customer, credit };
      }
      if (selected === "SHIPMENT_SENT" && shipment && order) {
        return { key: "SHIPMENT_SENT", customer, order, shipment };
      }
      if (selected === "SEPARATION_CONFIRMED" && payment && order) {
        return { key: "SEPARATION_CONFIRMED", customer, order, payment };
      }
      if (selected === "PAYMENT_VALIDATED" && payment && order) {
        return { key: "PAYMENT_VALIDATED", customer, order, payment };
      }
      if (order) {
        return { key: selected, customer, order } as BuildTemplateInput;
      }
      return { key: "BALANCE_REMINDER", customer } as BuildTemplateInput;
    })();
    return buildWhatsappMessage(base);
  }, [available, selected, customer, order, payment, shipment, credit]);

  const link = useMemo(
    () => (message ? buildWhatsappLink(customer.whatsapp, message) : null),
    [customer.whatsapp, message],
  );

  const isValid = Boolean(link && message);

  function handleCopy() {
    if (!message) return;
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      toast.error("Tu navegador no permite copiar al portapapeles.");
      return;
    }
    startTransition(() => {
      navigator.clipboard
        .writeText(message)
        .then(() => {
          setCopied(true);
          toast.success("Mensaje copiado al portapapeles.");
          setTimeout(() => setCopied(false), 1500);
        })
        .catch(() => {
          toast.error("No pudimos copiar el mensaje. Intenta nuevamente.");
        });
    });
  }

  function handleOpen() {
    if (!link) {
      toast.error("El número de WhatsApp no es válido.");
      return;
    }
    window.open(link, "_blank", "noopener,noreferrer");
  }

  if (variant === "compact") {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleOpen}
        disabled={!isValid}
        aria-label={`${label ?? "Abrir WhatsApp"} con ${customer.name}`}
      >
        <MessageCircle className="size-4" /> WhatsApp
      </Button>
    );
  }

  const triggerNode = trigger;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {triggerNode ? (
        <DialogTrigger render={triggerNode} />
      ) : (
        <DialogTrigger
          render={
            <Button type="button" size="sm" variant="outline" className="w-fit">
              <MessageCircle className="size-4" /> Plantillas
            </Button>
          }
        />
      )}
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="size-4 text-primary" /> Mensajes para {customer.name}
          </DialogTitle>
          <DialogDescription>
            Plantillas listas para enviar a {formatWhatsAppDisplay(customer.whatsapp)}. No se envía automáticamente.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Plantilla</label>
            <Select
              value={selected}
              onValueChange={(value) => setSelected(value as OrderTemplateKey)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {available.map((key) => (
                  <SelectItem key={key} value={key}>
                    {getTemplateLabel(key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {getTemplateDescription(selected)}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Mensaje</label>
            <Textarea
              readOnly
              value={message}
              rows={Math.min(10, Math.max(4, message.split("\n").length + 1))}
              className="text-xs"
              aria-label="Vista previa del mensaje"
            />
          </div>
        </DialogBody>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCopy}
            disabled={!isValid}
          >
            {copied ? (
              <>
                <Check className="size-4" /> Copiado
              </>
            ) : (
              <>
                <ClipboardCopy className="size-4" /> Copiar mensaje
              </>
            )}
          </Button>
          <Button type="button" variant="default" onClick={handleOpen} disabled={!isValid}>
            <Send className="size-4" /> Abrir WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WhatsAppQuickButton({
  customer,
  label = "WhatsApp",
}: {
  customer: CustomerContext;
  label?: string;
}) {
  const link = buildWhatsappLink(customer.whatsapp, "");
  if (!link) {
    return (
      <Button type="button" size="sm" variant="ghost" disabled>
        <MessageCircle className="size-4" /> {label}
      </Button>
    );
  }
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      render={
        <a href={link} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="size-4" /> {label}
        </a>
      }
    />
  );
}
