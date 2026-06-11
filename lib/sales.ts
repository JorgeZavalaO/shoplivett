// Lógica de venta rápida: crea pedido, items, pago pendiente, reserva stock.
// Todo corre dentro de una transacción Prisma.

import { getPrisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { reserveStock } from "@/lib/inventory";
import {
  generateOrderNumber,
  calculateOrderTotals,
  calculateOrderBalance,
  calculateOrderExpiry,
} from "@/lib/orders";
import { assertLiveIsOpen, LiveError } from "@/lib/live";
import { uploadImage, ImageUploadError } from "@/lib/blob";
import { createPayment, PaymentError } from "@/lib/payments";

export class OrderError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "CUSTOMER_NOT_FOUND"
      | "VARIANT_NOT_FOUND"
      | "INSUFFICIENT_STOCK"
      | "INVALID_ADVANCE"
      | "LIVE_CLOSED"
      | "BLOB_ERROR"
      | "PAYMENT_ERROR"
      | "CONFLICT",
  ) {
    super(message);
    this.name = "OrderError";
  }
}

export type QuickSaleInput = {
  customerId: string;
  liveSessionId?: string;
  items: { variantId: string; quantity: number }[];
  discount: string;
  shippingAmount: string;
  advanceAmount: string;
  paymentMethod: string;
  operationNumber?: string;
  notes?: string;
  receiptFiles?: File[];
};

export type QuickSaleResult = {
  orderId: string;
  orderNumber: string;
  paymentId: string;
};

export async function createQuickSale(
  input: QuickSaleInput,
): Promise<QuickSaleResult> {
  const advanceNum = Number(input.advanceAmount);
  if (Number.isNaN(advanceNum) || advanceNum <= 0) {
    throw new OrderError(
      "El adelanto es obligatorio y debe ser mayor a cero.",
      "INVALID_ADVANCE",
    );
  }

  const prisma = getPrisma();

  if (input.liveSessionId) {
    try {
      await assertLiveIsOpen(input.liveSessionId);
    } catch (error) {
      if (error instanceof LiveError) {
        throw new OrderError(error.message, "LIVE_CLOSED");
      }
      throw error;
    }
  }

  const customer = await prisma.customer.findUnique({
    where: { id: input.customerId },
  });
  if (!customer) {
    throw new OrderError("La clienta ya no existe.", "CUSTOMER_NOT_FOUND");
  }

  const variantIds = input.items.map((i) => i.variantId);
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds }, status: "ACTIVE", product: { isActive: true } },
    select: {
      id: true, code: true, price: true,
      stock: true, reservedStock: true, soldStock: true, color: true,
    },
  });
  const variantMap = new Map(variants.map((v) => [v.id, v]));
  for (const item of input.items) {
    if (!variantMap.has(item.variantId)) {
      throw new OrderError(
        `La variante ${item.variantId} no está disponible.`,
        "VARIANT_NOT_FOUND",
      );
    }
  }

  const lineItems = input.items.map((item) => ({
    variantId: item.variantId,
    quantity: item.quantity,
    unitPrice: variantMap.get(item.variantId)!.price.toString(),
  }));

  const totals = calculateOrderTotals(lineItems, input.discount, input.shippingAmount);
  const totalNum = Number(totals.total);
  const settings = await getSettings();
  const minimumAdvanceNum = Number(settings.minimumAdvance);

  if (totalNum <= minimumAdvanceNum && advanceNum < totalNum) {
    throw new OrderError(
      `El total (S/${totals.total}) es menor o igual al adelanto mínimo (S/${minimumAdvanceNum.toFixed(2)}). Se requiere pago completo.`,
      "INVALID_ADVANCE",
    );
  }
  if (totalNum > minimumAdvanceNum && advanceNum < minimumAdvanceNum) {
    throw new OrderError(
      `El adelanto mínimo es S/${minimumAdvanceNum.toFixed(2)}.`,
      "INVALID_ADVANCE",
    );
  }

  const uploadedReceipts: { url: string; pathname: string }[] = [];
  if (input.receiptFiles && input.receiptFiles.length > 0) {
    for (const file of input.receiptFiles) {
      if (file.size === 0) continue;
      try {
        const uploaded = await uploadImage(
          file,
          `payments/receipts`,
          `quick-sale-${Date.now()}`,
        );
        uploadedReceipts.push({ url: uploaded.url, pathname: uploaded.pathname });
      } catch (error) {
        if (error instanceof ImageUploadError) {
          throw new OrderError(error.message, "BLOB_ERROR");
        }
        throw error;
      }
    }
  }

  let orderResult: { orderId: string; orderNumber: string; paymentId: string };
  try {
    orderResult = await prisma.$transaction(
      async (tx) => {
        const orderNumber = await generateOrderNumber(tx);
        const expiresAt = await calculateOrderExpiry(new Date(), settings.reservationDays);
        const balance = calculateOrderBalance(totals.total, "0");

        const order = await tx.order.create({
          data: {
            orderNumber,
            customerId: input.customerId,
            liveSessionId: input.liveSessionId ?? null,
            status: "PAYMENT_VALIDATION_PENDING",
            subtotal: totals.subtotal,
            discount: input.discount || "0",
            shippingAmount: input.shippingAmount || "0",
            total: totals.total,
            validatedPaid: "0",
            balance,
            expiresAt,
            notes: input.notes ?? null,
          },
        });

        for (const li of lineItems) {
          await tx.orderItem.create({
            data: {
              orderId: order.id,
              variantId: li.variantId,
              quantity: li.quantity,
              unitPrice: li.unitPrice,
              lineTotal: (Number(li.unitPrice) * li.quantity).toFixed(2),
            },
          });
        }

        const created = await createPayment({
          customerId: input.customerId,
          method: input.paymentMethod as Parameters<typeof createPayment>[0]["method"],
          amount: input.advanceAmount,
          operationNumber: input.operationNumber ?? null,
          notes: null,
          sourceOrderId: order.id,
          applications: [{ orderId: order.id, amount: input.advanceAmount }],
        });

        for (const r of uploadedReceipts) {
          await tx.paymentReceipt.create({
            data: {
              paymentId: created.paymentId,
              url: r.url,
              pathname: r.pathname,
            },
          });
        }

        for (const item of input.items) {
          await reserveStock(item.variantId, item.quantity, {
            reason: `Orden ${orderNumber}`,
            tx,
          });
        }

        return { orderId: order.id, orderNumber, paymentId: created.paymentId };
      },
      { isolationLevel: "Serializable", maxWait: 5000, timeout: 15000 },
    );
  } catch (error) {
    if (error instanceof PaymentError) {
      throw new OrderError(error.message, "PAYMENT_ERROR");
    }
    if (error instanceof OrderError) throw error;
    throw error;
  }

  return orderResult;
}
