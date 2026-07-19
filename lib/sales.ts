// Lógica de venta rápida: crea pedido, items, pago pendiente, reserva stock.
// Todo corre dentro de una transacción Prisma.

import { Prisma, type SalesChannel } from "@prisma/client";

import { getPrisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { InventoryError, reserveStock } from "@/lib/inventory";
import {
  generateOrderNumber,
  calculateOrderTotals,
  calculateOrderBalance,
  calculateOrderExpiry,
} from "@/lib/orders";
import { uploadImage, deleteImage, ImageUploadError } from "@/lib/blob";
import { createPayment, PaymentError } from "@/lib/payments";
import { auditInTx } from "@/lib/audit";
import { toCents, centsToDecimalString } from "@/lib/money";
import {
  BatchAllocationError,
  checkBatchStock,
  distributeOrderDiscount,
  persistQuickSaleLine,
} from "@/lib/order-batch-allocation";

export class OrderError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "CUSTOMER_NOT_FOUND"
      | "CUSTOMER_BLOCKED"
      | "VARIANT_NOT_FOUND"
      | "INSUFFICIENT_STOCK"
      | "INVALID_ADVANCE"
      | "LIVE_CLOSED"
      | "BLOB_ERROR"
      | "PAYMENT_ERROR"
      | "CONFLICT"
      | "INSUFFICIENT_BATCH_STOCK"
      | "BATCH_NOT_CALCULATED",
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
  salesChannel?: SalesChannel;
  receiptFiles?: File[];
  actorId?: string | null;
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

  const customer = await prisma.customer.findUnique({
    where: { id: input.customerId },
  });
  if (!customer) {
    throw new OrderError("La clienta ya no existe.", "CUSTOMER_NOT_FOUND");
  }
  if (customer.status === "BLOCKED") {
    throw new OrderError(
      "La clienta está bloqueada y no puede registrar nuevas ventas.",
      "CUSTOMER_BLOCKED",
    );
  }

  const variantIds = input.items.map((i) => i.variantId);
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds }, status: "ACTIVE", product: { isActive: true } },
    select: {
      id: true, code: true, price: true, cost: true,
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

  // Verificación temprana de stock por lote (FIFO). Si la variante opera
  // con lotes, no basta con `ProductVariant.stock`; el origen de verdad
  // para la venta es `ImportBatchItem.quantityAvailable` (Sprint 21).
  await Promise.all(
    input.items.map(async (item) => {
      try {
        await checkBatchStock(prisma, item.variantId, item.quantity);
      } catch (error) {
        if (error instanceof BatchAllocationError) {
          if (error.code === "INSUFFICIENT_BATCH_STOCK") {
            throw new OrderError(error.message, "INSUFFICIENT_BATCH_STOCK");
          }
          throw new OrderError(error.message, "INSUFFICIENT_STOCK");
        }
        throw error;
      }
    }),
  );

  const lineItems = input.items.map((item) => ({
    variantId: item.variantId,
    quantity: item.quantity,
    unitPrice: variantMap.get(item.variantId)!.price.toString(),
  }));

  const totals = calculateOrderTotals(lineItems, input.discount, input.shippingAmount);
  const totalCents = toCents(totals.total, { allowNegative: true });
  const discountCents = toCents(input.discount || "0", { allowNegative: true });
  const shippingCents = toCents(input.shippingAmount || "0", {
    allowNegative: true,
  });
  const discountByVariant = distributeOrderDiscount(
    lineItems.map((l) => ({
      variantId: l.variantId,
      quantity: l.quantity,
      lineSubtotalCents:
        toCents(l.unitPrice, { allowNegative: true }) * l.quantity,
    })),
    discountCents,
  );
  const shippingByVariant = distributeOrderDiscount(
    lineItems.map((l) => ({
      variantId: l.variantId,
      quantity: l.quantity,
      lineSubtotalCents:
        toCents(l.unitPrice, { allowNegative: true }) * l.quantity,
    })),
    shippingCents,
  );
  const settings = await getSettings();
  const minimumAdvanceCents = toCents(settings.minimumAdvance.toString(), {
    allowNegative: true,
  });

  if (totalCents <= minimumAdvanceCents && toCents(input.advanceAmount) < totalCents) {
    throw new OrderError(
      `El total (S/${totals.total}) es menor o igual al adelanto mínimo (S/${centsToDecimalString(minimumAdvanceCents)}). Se requiere pago completo.`,
      "INVALID_ADVANCE",
    );
  }
  if (totalCents > minimumAdvanceCents && toCents(input.advanceAmount) < minimumAdvanceCents) {
    throw new OrderError(
      `El adelanto mínimo es S/${centsToDecimalString(minimumAdvanceCents)}.`,
      "INVALID_ADVANCE",
    );
  }

  const uploadedReceipts: { url: string; pathname: string }[] = [];
  if (input.receiptFiles && input.receiptFiles.length > 0) {
    const validFiles = input.receiptFiles.filter((f) => f.size > 0);
    const uploadResults = await Promise.allSettled(
      validFiles.map((file) =>
        uploadImage(
          file,
          `payments/receipts`,
          `quick-sale-${Date.now()}`,
          { access: "private" },
        ),
      ),
    );
    for (const r of uploadResults) {
      if (r.status === "rejected") {
        const reason = r.reason;
        if (reason instanceof ImageUploadError) {
          throw new OrderError(reason.message, "BLOB_ERROR");
        }
        throw reason;
      }
      uploadedReceipts.push({ url: r.value.url, pathname: r.value.pathname });
    }
  }

  let orderResult: { orderId: string; orderNumber: string; paymentId: string } | undefined;
  const MAX_ORDER_CODE_RETRIES = 5;
  let lastError: unknown;

  try {
    for (let attempt = 0; attempt < MAX_ORDER_CODE_RETRIES; attempt++) {
      try {
        orderResult = await prisma.$transaction(
          async (tx) => {
          // Revalidar estado del cliente dentro de la transacción para cerrar
          // la ventana de carrera entre la lectura inicial y el commit
          // (AUD-UX-009): un admin podría bloquear al cliente justo entre
          // ambos momentos.
          const currentCustomer = await tx.customer.findUnique({
            where: { id: input.customerId },
            select: { status: true },
          });
          if (!currentCustomer) {
            throw new OrderError("La clienta ya no existe.", "CUSTOMER_NOT_FOUND");
          }
          if (currentCustomer.status === "BLOCKED") {
            throw new OrderError(
              "La clienta está bloqueada y no puede registrar nuevas ventas.",
              "CUSTOMER_BLOCKED",
            );
          }

          const orderNumber = await generateOrderNumber(tx);
          const expiresAt = await calculateOrderExpiry(new Date(), settings.reservationDays);
          const balance = calculateOrderBalance(totals.total, "0");
          const live = input.liveSessionId
            ? await tx.liveSession.findUnique({
                where: { id: input.liveSessionId },
                select: { id: true, status: true },
              })
            : null;
          const resolvedLiveSessionId = live?.status === "OPEN" ? live.id : null;

          const order = await tx.order.create({
            data: {
              orderNumber,
              customerId: input.customerId,
              liveSessionId: resolvedLiveSessionId,
              status: "PAYMENT_VALIDATION_PENDING",
              subtotal: totals.subtotal,
              discount: input.discount || "0",
              shippingAmount: input.shippingAmount || "0",
              total: totals.total,
              validatedPaid: "0",
              balance,
              salesChannel: input.salesChannel ?? "WHATSAPP_DIRECTO",
              expiresAt,
              notes: input.notes ?? null,
            },
          });

          await Promise.all(
            lineItems.map(async (li) => {
              const variant = variantMap.get(li.variantId)!;
              const persist = await persistQuickSaleLine({
                tx,
                orderId: order.id,
                item: {
                  variantId: li.variantId,
                  quantity: li.quantity,
                  unitPrice: li.unitPrice,
                  variant: { cost: variant.cost },
                },
                lineDiscountCents: discountByVariant.get(li.variantId) ?? 0,
                shippingAllocationCents:
                  shippingByVariant.get(li.variantId) ?? 0,
              });
              await auditInTx(tx, input.actorId ?? null, {
                action: "ORDER_BATCH_ALLOCATED",
                entity: "OrderItem",
                entityId: persist.orderItemId,
                metadata: {
                  orderId: order.id,
                  variantId: li.variantId,
                  quantity: li.quantity,
                  costSource: persist.costSource,
                  unitCostPen: persist.unitCostPen,
                  allocations: persist.allocations.map((a) => ({
                    batchId: a.batchId,
                    batchItemId: a.batchItemId,
                    quantity: a.quantity,
                    unitCostPen: a.unitCostPen,
                    subtotalCostPen: a.subtotalCostPen,
                  })),
                },
              });
            }),
          );

          const created = await createPayment(
            {
              customerId: input.customerId,
              method: input.paymentMethod as Parameters<typeof createPayment>[0]["method"],
              amount: input.advanceAmount,
              operationNumber: input.operationNumber ?? null,
              notes: null,
              sourceOrderId: order.id,
              applications: [{ orderId: order.id, amount: input.advanceAmount }],
            },
            { tx },
          );

          if (uploadedReceipts.length > 0) {
            await tx.paymentReceipt.createMany({
              data: uploadedReceipts.map((r) => ({
                paymentId: created.paymentId,
                url: r.url,
                pathname: r.pathname,
              })),
            });
          }

          await Promise.all(
            input.items.map((item) =>
              reserveStock(item.variantId, item.quantity, {
                reason: `Orden ${orderNumber}`,
                tx,
              }),
            ),
          );

          await auditInTx(tx, input.actorId ?? null, {
            action: "ORDER_CREATED",
            entity: "Order",
            entityId: order.id,
            metadata: {
              orderNumber,
              customerId: input.customerId,
              total: totals.total,
              advance: input.advanceAmount,
              paymentMethod: input.paymentMethod,
              salesChannel: input.salesChannel ?? "WHATSAPP_DIRECTO",
              items: lineItems.map((li) => ({
                variantId: li.variantId,
                quantity: li.quantity,
                unitPrice: li.unitPrice,
              })),
              liveSessionId: resolvedLiveSessionId,
            },
          });

          return { orderId: order.id, orderNumber, paymentId: created.paymentId };
        },
        { isolationLevel: "Serializable", maxWait: 5000, timeout: 15000 },
      );

      // Success — exit retry loop
            break;
          } catch (error) {
            lastError = error;
            if (
              error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === "P2002"
            ) {
              if (attempt < MAX_ORDER_CODE_RETRIES - 1) {
                continue;
              }
              throw new OrderError("No pudimos generar el número de pedido. Intenta nuevamente.", "CONFLICT");
            }
            throw error;
          }
        }
      } catch (error) {
        // Compensar uploads huérfanos si todas las transacciones fallan.
        if (uploadedReceipts.length > 0) {
          await Promise.all(
            uploadedReceipts.map((r) =>
              deleteImage(r.pathname).catch(() => {
                // El fallo de limpieza se ignora: el blob es preferible a fallar la acción.
              }),
            ),
          );
        }
        if (error instanceof PaymentError) {
          throw new OrderError(error.message, "PAYMENT_ERROR");
        }
        if (error instanceof BatchAllocationError) {
          if (error.code === "INSUFFICIENT_BATCH_STOCK") {
            throw new OrderError(error.message, "INSUFFICIENT_BATCH_STOCK");
          }
          if (error.code === "CONFLICT") {
            throw new OrderError(error.message, "CONFLICT");
          }
          throw new OrderError(error.message, "INSUFFICIENT_STOCK");
        }
        if (error instanceof InventoryError) {
          if (error.code === "INSUFFICIENT_STOCK") {
            throw new OrderError(
              "No hay stock disponible para completar la venta. El producto ya está reservado en otro pedido o se agotó mientras se procesaba esta operación.",
              "INSUFFICIENT_STOCK",
            );
          }
          if (error.code === "INSUFFICIENT_RESERVED") {
            throw new OrderError(
              "La reserva de stock ya no es válida. Revisa el estado del pedido e intenta nuevamente.",
              "CONFLICT",
            );
          }
          if (error.code === "CONFLICT") {
            throw new OrderError(error.message, "CONFLICT");
          }
          throw new OrderError(error.message, "INSUFFICIENT_STOCK");
        }
        if (error instanceof OrderError) throw error;
        throw error;
      }

  // This shouldn't be reached, but TypeScript needs the guard:
  if (!orderResult) {
    throw lastError instanceof Error ? lastError : new Error("Error desconocido al crear el pedido.");
  }

  return orderResult;
}
