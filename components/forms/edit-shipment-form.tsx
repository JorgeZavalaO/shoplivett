"use client";

import { useRef, useState } from "react";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SHIPPING_METHOD_LABELS } from "@/lib/settings-defaults";
import {
  updateShipmentAction,
  type ShipmentActionResult,
} from "@/actions/shipments";

type ShippingMethod = "DELIVERY_PROPIO" | "OLVA" | "SHALOM" | "MOTORIZADO" | "RECOJO";

type Props = {
  shipmentId: string;
  defaultValues: {
    shippingMethod: ShippingMethod;
    shippingCost: string;
    realCostPen: string;
    isFreeShipping: boolean;
    agencyName: string | null;
    trackingCode: string | null;
    addressSnapshot: string | null;
    districtSnapshot: string | null;
    referenceSnapshot: string | null;
    notes: string | null;
  };
};

const initialState: ShipmentActionResult = { ok: false };

export function EditShipmentForm({ shipmentId, defaultValues }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<ShipmentActionResult>(initialState);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>(defaultValues.shippingMethod);
  const [shippingCost, setShippingCost] = useState(defaultValues.shippingCost);
  const [realCost, setRealCost] = useState(defaultValues.realCostPen);
  const [isFreeShipping, setIsFreeShipping] = useState(defaultValues.isFreeShipping);
  const [agencyName, setAgencyName] = useState(defaultValues.agencyName ?? "");
  const [trackingCode, setTrackingCode] = useState(defaultValues.trackingCode ?? "");
  const [addressSnapshot, setAddressSnapshot] = useState(defaultValues.addressSnapshot ?? "");
  const [districtSnapshot, setDistrictSnapshot] = useState(defaultValues.districtSnapshot ?? "");
  const [referenceSnapshot, setReferenceSnapshot] = useState(defaultValues.referenceSnapshot ?? "");
  const [notes, setNotes] = useState(defaultValues.notes ?? "");

  const hasChanges =
    shippingMethod !== defaultValues.shippingMethod ||
    shippingCost !== defaultValues.shippingCost ||
    realCost !== defaultValues.realCostPen ||
    isFreeShipping !== defaultValues.isFreeShipping ||
    agencyName !== (defaultValues.agencyName ?? "") ||
    trackingCode !== (defaultValues.trackingCode ?? "") ||
    addressSnapshot !== (defaultValues.addressSnapshot ?? "") ||
    districtSnapshot !== (defaultValues.districtSnapshot ?? "") ||
    referenceSnapshot !== (defaultValues.referenceSnapshot ?? "") ||
    notes !== (defaultValues.notes ?? "");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!hasChanges) return;
    setConfirmOpen(true);
  }

  async function handleConfirm() {
    if (!formRef.current) return;
    setPending(true);
    const fd = new FormData(formRef.current);
    fd.set("shipmentId", shipmentId);
    fd.set("isFreeShipping", isFreeShipping ? "true" : "false");
    const result = await updateShipmentAction(undefined, fd);
    setPending(false);
    setConfirmOpen(false);
    setState(result);
  }

  return (
    <>
      <form ref={formRef} className="flex flex-col gap-3" noValidate onSubmit={handleSubmit}>
        <input type="hidden" name="shipmentId" value={shipmentId} />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Método de envío</label>
          <select
            name="shippingMethod"
            value={shippingMethod}
            onChange={(e) => setShippingMethod(e.target.value as ShippingMethod)}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            {(Object.entries(SHIPPING_METHOD_LABELS) as [ShippingMethod, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              name="isFreeShipping"
              checked={isFreeShipping}
              onChange={(e) => setIsFreeShipping(e.target.checked)}
              className="size-4"
            />
            Envío gratis
          </label>
        </div>

        {!isFreeShipping ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Costo (S/)</label>
            <Input
              name="shippingCost"
              type="text"
              inputMode="decimal"
              value={shippingCost}
              onChange={(e) => setShippingCost(e.target.value)}
              placeholder="0.00"
            />
            {state.fieldErrors?.shippingCost ? (
              <p className="text-xs text-destructive">{state.fieldErrors.shippingCost}</p>
            ) : null}
          </div>
        ) : (
          <input type="hidden" name="shippingCost" value="0" />
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Costo real asumido</label>
          <Input
            name="realCost"
            type="text"
            inputMode="decimal"
            value={realCost}
            onChange={(e) => setRealCost(e.target.value)}
            placeholder="0.00"
          />
          {state.fieldErrors?.realCost ? (
            <p className="text-xs text-destructive">{state.fieldErrors.realCost}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Agencia</label>
          <Input
            name="agencyName"
            value={agencyName}
            onChange={(e) => setAgencyName(e.target.value)}
            placeholder="Nombre de la agencia"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Tracking</label>
          <Input
            name="trackingCode"
            value={trackingCode}
            onChange={(e) => setTrackingCode(e.target.value)}
            placeholder="Código de seguimiento"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Dirección</label>
          <Input
            name="addressSnapshot"
            value={addressSnapshot}
            onChange={(e) => setAddressSnapshot(e.target.value)}
            placeholder="Dirección de envío"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Distrito</label>
          <Input
            name="districtSnapshot"
            value={districtSnapshot}
            onChange={(e) => setDistrictSnapshot(e.target.value)}
            placeholder="Distrito"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Referencia</label>
          <Input
            name="referenceSnapshot"
            value={referenceSnapshot}
            onChange={(e) => setReferenceSnapshot(e.target.value)}
            placeholder="Referencia de ubicación"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Notas</label>
          <textarea
            name="notes"
            rows={2}
            maxLength={1000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas internas"
            className="min-h-12 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>

        {state.message && !state.ok ? (
          <p className="rounded-md bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
            {state.message}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={!hasChanges || pending}
          variant="outline"
          className="w-full"
        >
          <Pencil className="size-4" /> Guardar cambios
        </Button>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirmar edición de envío"
        description={
          <div className="flex flex-col gap-1 text-sm">
            <p><strong>Método:</strong> {SHIPPING_METHOD_LABELS[shippingMethod]}</p>
            <p><strong>Costo:</strong> {isFreeShipping ? "Gratis" : `S/ ${shippingCost || "0.00"}`}</p>
            <p><strong>Costo real:</strong> S/ {realCost || "0.00"}</p>
            {agencyName ? <p><strong>Agencia:</strong> {agencyName}</p> : null}
            {trackingCode ? <p><strong>Tracking:</strong> {trackingCode}</p> : null}
          </div>
        }
        confirmLabel="Guardar cambios"
        pending={pending}
        onConfirm={handleConfirm}
      />
    </>
  );
}
