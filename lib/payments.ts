// Motor transaccional de pagos. Maneja registro, aplicación a pedidos,
// validación y rechazo. La validación puede generar crédito por sobrepago
// o registrar devolución, todo dentro de la misma transacción Prisma para
// cumplir RNF-S08-03 y Sprint 9.

import { Prisma, PaymentStatus, type PaymentMethod } from "@prisma/client";

import { getPrisma } from "@/lib/prisma";
import { confirmSaleStock } from "@/lib/inventory";
import { closeUnpaidReservation, OrderExpiryError } from "@/lib/order-expiry";
import { PAYMENT_METHOD_LABELS } from "@/lib/settings-defaults";
import { CreditError } from "@/lib/credits";
import { toCents, centsToDecimalString, type Cents } from "@/lib/money";
import { auditInTx } from "@/lib/audit";
import { recognizeOrderProfit } from "@/lib/order-batch-allocation";
import {
  coercePaymentMethodFees,
  type PaymentMethodFees,
} from "@/lib/settings-defaults";

export class PaymentError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "PAYMENT_NOT_FOUND"
      | "CUSTOMER_NOT_FOUND"
      | "ORDER_NOT_FOUND"
      | "INVALID_AMOUNT"
      | "INVALID_APPLICATION_SUM"
      | "ORDER_OVERPAYMENT"
      | "CUSTOMER_MISMATCH"
      | "ALREADY_VALIDATED"
      | "ALREADY_REJECTED"
      | "OVERPAYMENT_NOT_ALLOWED"
      | "REFUND_NOT_ALLOWED"
      | "CONFLICT",
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

function paymentToCents(value: string): Cents {
  try {
    return toCents(value);
  } catch {
    throw new PaymentError("Monto inválido.", "INVALID_AMOUNT");
  }
}

export type PaymentApplicationInput = {
  orderId: string;
  amount: string;
};

export type CreatePaymentInput = {
  customerId: string;
  method: PaymentMethod;
  amount: string;
  operationNumber?: string | null;
  notes?: string | null;
  sourceOrderId?: string | null;
  applications: PaymentApplicationInput[];
};

export type ValidatePaymentInput = {
  paymentId: string;
  /** Cómo tratar el excedente tras aplicar. Por defecto se rechaza validación si hay excedente. */
  excessTreatment?: "CREDIT" | "REFUND" | "REJECT";
  /** Motivo opcional (devolución o nota). */
  excessNotes?: string | null;
  validatedById?: string | null;
  actorId?: string | null;
};

export type RejectPaymentInput = {
  paymentId: string;
  reason: string;
  actorId?: string | null;
};

export type PaymentCreateResult = {
  paymentId: string;
};

export type ValidatePaymentResult = {
  paymentId: string;
  excessCents: number;
  excessTreatment: "CREDIT" | "REFUND" | "NONE";
  creditId?: string;
};

function assertValidAmount(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) {
    throw new PaymentError("Monto inválido.", "INVALID_AMOUNT");
  }
  const cents = paymentToCents(value);
  if (cents <= 0) {
    throw new PaymentError("El monto debe ser mayor a 0.", "INVALID_AMOUNT");
  }
}

function aggregateApplications(
  applications: PaymentApplicationInput[],
): Cents {
  return applications.reduce((acc, a) => acc + paymentToCents(a.amount), 0);
}

export async function createPayment(
  input: CreatePaymentInput,
  options: { tx?: Prisma.TransactionClient } = {},
): Promise<PaymentCreateResult> {
  assertValidAmount(input.amount);

  for (const a of input.applications) {
    if (!/^\d+(\.\d{1,2})?$/.test(a.amount.trim())) {
      throw new PaymentError("Monto aplicado inválido.", "INVALID_AMOUNT");
    }
    if (paymentToCents(a.amount) <= 0) {
      throw new PaymentError("El monto aplicado debe ser mayor a 0.", "INVALID_AMOUNT");
    }
  }

  const paymentCents = paymentToCents(input.amount);
  const appliedCents = aggregateApplications(input.applications);
  if (appliedCents > paymentCents) {
    throw new PaymentError(
      "La suma aplicada supera el monto del pago.",
      "INVALID_APPLICATION_SUM",
    );
  }

  const externalTx = options.tx;
  const execute = async (tx: Prisma.TransactionClient) => {
    const customer = await tx.customer.findUnique({ where: { id: input.customerId } });
    if (!customer) {
      throw new PaymentError("La clienta ya no existe.", "CUSTOMER_NOT_FOUND");
    }

    if (input.applications.length > 0) {
      const orderIds = input.applications.map((a) => a.orderId);
      const uniqueIds = Array.from(new Set(orderIds));
      const orders = await tx.order.findMany({
        where: { id: { in: uniqueIds } },
        select: {
          id: true,
          customerId: true,
          total: true,
          validatedPaid: true,
          balance: true,
          status: true,
        },
      });
      if (orders.length !== uniqueIds.length) {
        throw new PaymentError("Uno de los pedidos ya no existe.", "ORDER_NOT_FOUND");
      }
      const mismatched = orders.find((o) => o.customerId !== input.customerId);
      if (mismatched) {
        throw new PaymentError(
          "Todos los pedidos deben pertenecer a la misma clienta.",
          "CUSTOMER_MISMATCH",
        );
      }
      // Validar contra sobreaplicación y pedidos cancelados/vencidos.
      for (const app of input.applications) {
        const order = orders.find((o) => o.id === app.orderId);
        if (!order) continue;
        if (order.status === "CANCELLED" || order.status === "EXPIRED") {
          throw new PaymentError(
            `No puedes aplicar el pago a un pedido ${order.status === "CANCELLED" ? "cancelado" : "vencido"}.`,
            "CUSTOMER_MISMATCH",
          );
        }
        const balance = paymentToCents(order.balance.toString());
        if (paymentToCents(app.amount) > balance) {
          throw new PaymentError(
            `La aplicación al pedido ${app.orderId} (S/${app.amount}) supera su saldo (S/${centsToDecimalString(balance)}).`,
            "ORDER_OVERPAYMENT",
          );
        }
      }
    }

    const payment = await tx.payment.create({
      data: {
        customerId: input.customerId,
        orderId: input.sourceOrderId ?? null,
        method: input.method,
        status: "PENDING",
        amount: centsToDecimalString(paymentCents),
        operationNumber: input.operationNumber ?? null,
        notes: input.notes ?? null,
      },
    });

    for (const a of input.applications) {
      await tx.paymentApplication.create({
        data: {
          paymentId: payment.id,
          orderId: a.orderId,
          amount: centsToDecimalString(paymentToCents(a.amount)),
        },
      });
    }

    return { paymentId: payment.id };
  };

  if (externalTx) {
    return execute(externalTx);
  }
  return getPrisma().$transaction(execute);
}

type OrderPaymentSummary = {
  orderId: string;
  total: Cents;
  validatedPaid: Cents;
  balance: Cents;
};

async function summarizeOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<OrderPaymentSummary> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      total: true,
      validatedPaid: true,
      balance: true,
    },
  });
  if (!order) {
    throw new PaymentError("El pedido ya no existe.", "ORDER_NOT_FOUND");
  }
  return {
    orderId: order.id,
    total: paymentToCents(order.total.toString()),
    validatedPaid: paymentToCents(order.validatedPaid.toString()),
    balance: paymentToCents(order.balance.toString()),
  };
}

function recomputeOrderState(summary: OrderPaymentSummary, newValidated: Cents) {
  const newBalance = summary.total - newValidated;
  const balance = newBalance < 0 ? 0 : newBalance;
  const validated = newValidated > summary.total ? summary.total : newValidated;
  let status: "PAID" | "PARTIALLY_PAID" | "RESERVED";
  if (validated >= summary.total) {
    status = "PAID";
  } else if (validated > 0) {
    status = "PARTIALLY_PAID";
  } else {
    status = "RESERVED";
  }
  return {
    validatedPaid: centsToDecimalString(validated),
    balance: centsToDecimalString(balance),
    status,
  };
}

async function recognizePaidOrderProfit(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  const settings = await tx.businessSettings.findUnique({
    where: { id: "default" },
  });
  const fees: PaymentMethodFees = settings
    ? coercePaymentMethodFees(settings.paymentMethodFees)
    : { YAPE: 0, PLIN: 0, CASH: 0, OTHER: 0 };
  const packaging = settings ? settings.standardPackagingCostPen.toString() : "0.00";
  const result = await recognizeOrderProfit(tx, orderId, {
    paymentMethodFees: fees,
    packagingCostPen: packaging,
  });
  await auditInTx(tx, null, {
    action: "ORDER_PROFIT_RECOGNIZED",
    entity: "Order",
    entityId: orderId,
    metadata: {
      productCostPen: centsToDecimalString(result.productCostCents),
      grossProfitPen: centsToDecimalString(result.grossProfitCents),
      paymentFeePen: centsToDecimalString(result.paymentFeeCents),
      packagingCostPen: centsToDecimalString(result.packagingCostCents),
      netProfitPen: centsToDecimalString(result.netProfitCents),
    },
  });
}

export async function validatePayment(
  input: ValidatePaymentInput,
): Promise<ValidatePaymentResult> {
  const treatment = input.excessTreatment ?? "REJECT";
  const prisma = getPrisma();
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const payment = await tx.payment.findUnique({
          where: { id: input.paymentId },
          include: { applications: true },
        });
        if (!payment) {
          throw new PaymentError("El pago ya no existe.", "PAYMENT_NOT_FOUND");
        }
        if (payment.status === "VALIDATED") {
          throw new PaymentError("El pago ya fue validado.", "ALREADY_VALIDATED");
        }
        if (payment.status === "REJECTED") {
          throw new PaymentError("El pago fue rechazado.", "ALREADY_REJECTED");
        }

        if (payment.applications.length === 0) {
          throw new PaymentError(
            "El pago no tiene pedidos aplicados. Edita la aplicación antes de validar.",
            "INVALID_APPLICATION_SUM",
          );
        }

        const appliedCents = payment.applications.reduce(
          (acc, a) => acc + paymentToCents(a.amount.toString()),
          0,
        );

        // Validar contra sobreaplicación por pedido.
        const orderIds = Array.from(new Set(payment.applications.map((a) => a.orderId)));
        const orders = await tx.order.findMany({
          where: { id: { in: orderIds } },
          select: {
            id: true,
            customerId: true,
            total: true,
            validatedPaid: true,
            balance: true,
          },
        });
        if (orders.length !== orderIds.length) {
          throw new PaymentError("Uno de los pedidos ya no existe.", "ORDER_NOT_FOUND");
        }
        const mismatched = orders.find((o) => o.customerId !== payment.customerId);
        if (mismatched) {
          throw new PaymentError(
            "Los pedidos aplicados no pertenecen a la misma clienta del pago.",
            "CUSTOMER_MISMATCH",
          );
        }
        for (const app of payment.applications) {
          const order = orders.find((o) => o.id === app.orderId);
          if (!order) continue;
          const balance = paymentToCents(order.balance.toString());
          if (paymentToCents(app.amount.toString()) > balance) {
            throw new PaymentError(
              `La aplicación al pedido ${app.orderId} (S/${app.amount.toString()}) supera su saldo (S/${centsToDecimalString(balance)}).`,
              "ORDER_OVERPAYMENT",
            );
          }
        }

        // Excedente = (lo aplicado - lo que se necesitaba) + (monto del pago - lo aplicado).
        // El segundo término cubre el caso en que el operador dejó dinero sin asignar
        // a ningún pedido: sin esto, validar el pago "perdería" ese monto.
        let requiredCents = 0;
        for (const order of orders) {
          requiredCents += paymentToCents(order.balance.toString());
        }
        const paymentAmountCents = paymentToCents(payment.amount.toString());
        const overpaymentCents = Math.max(0, appliedCents - requiredCents);
        const unallocatedCents = Math.max(0, paymentAmountCents - appliedCents);
        const excessCents = overpaymentCents + unallocatedCents;
        const hasExcess = excessCents > 0;

        if (hasExcess) {
          if (treatment === "REJECT") {
            throw new PaymentError(
              `El pago cubre S/${centsToDecimalString(requiredCents)} de los pedidos pero tiene un excedente de S/${centsToDecimalString(excessCents)}. Indica si se registra como crédito o como devolución.`,
              "INVALID_APPLICATION_SUM",
            );
          }
          if (treatment === "CREDIT") {
            const settings = await tx.businessSettings.findUnique({ where: { id: "default" } });
            if (!settings || !settings.allowOverpaymentCredit) {
              throw new PaymentError(
                "La configuración no permite generar crédito por sobrepago.",
                "OVERPAYMENT_NOT_ALLOWED",
              );
            }
          }
          if (treatment === "REFUND") {
            const settings = await tx.businessSettings.findUnique({ where: { id: "default" } });
            if (!settings || !settings.allowRefund) {
              throw new PaymentError(
                "La configuración no permite registrar devoluciones.",
                "REFUND_NOT_ALLOWED",
              );
            }
          }
        }

        // Aplicar montos a pedidos respetando el balance real.
        for (const app of payment.applications) {
          const summary = await summarizeOrder(tx, app.orderId);
          const appCents = paymentToCents(app.amount.toString());
          const effective = Math.min(appCents, summary.balance);
          const newValidated = summary.validatedPaid + effective;
          const next = recomputeOrderState(summary, newValidated);
          await tx.order.update({
            where: { id: app.orderId },
            data: {
              validatedPaid: next.validatedPaid,
              balance: next.balance,
              status: next.status,
            },
          });

          if (next.status === "PAID") {
            const items = await tx.orderItem.findMany({
              where: { orderId: app.orderId },
              select: { variantId: true, quantity: true },
            });
            for (const item of items) {
              await confirmSaleStock(item.variantId, item.quantity, {
                reason: `Pago ${payment.id} validado`,
                tx,
              });
            }
            await recognizePaidOrderProfit(tx, app.orderId);
          }
        }

        let creditId: string | undefined;
        if (hasExcess && treatment === "CREDIT") {
          // Crear crédito por el excedente. Usamos un cliente Prisma nuevo
          // porque la transacción actual ya usa `tx`; Prisma permite
          // crear `CustomerCredit` con `tx` directamente.
          const created = await tx.customerCredit.create({
            data: {
              customerId: payment.customerId,
              paymentId: payment.id,
              origin: "OVERPAYMENT",
              status: "AVAILABLE",
              amount: centsToDecimalString(excessCents),
              availableAmount: centsToDecimalString(excessCents),
              notes: input.excessNotes ?? "Excedente por sobrepago",
              createdById: input.validatedById ?? null,
            },
          });
          creditId = created.id;
        } else if (hasExcess && treatment === "REFUND") {
          // Registrar devolución: crédito con origen REFUND ya consumido.
          await tx.customerCredit.create({
            data: {
              customerId: payment.customerId,
              paymentId: payment.id,
              origin: "REFUND",
              status: "VOIDED",
              amount: centsToDecimalString(excessCents),
              availableAmount: "0.00",
              notes: input.excessNotes ?? "Devolución por excedente",
              createdById: input.validatedById ?? null,
            },
          });
        }

        await tx.payment.update({
          where: { id: input.paymentId },
          data: {
            status: "VALIDATED",
            validatedAt: new Date(),
            validatedById: input.validatedById ?? null,
            rejectedAt: null,
            rejectedById: null,
            rejectionReason: null,
          },
        });

        await auditInTx(tx, input.actorId ?? input.validatedById ?? null, {
          action: "PAYMENT_VALIDATED",
          entity: "Payment",
          entityId: input.paymentId,
          metadata: {
            customerId: payment.customerId,
            paymentAmount: payment.amount.toString(),
            appliedCents: centsToDecimalString(appliedCents),
            excessCents: centsToDecimalString(excessCents),
            excessTreatment: hasExcess
              ? treatment === "REJECT"
                ? "CREDIT"
                : treatment
              : "NONE",
            creditId: creditId ?? null,
            affectedOrderIds: payment.applications.map((a) => a.orderId),
          },
        });

        return {
          paymentId: input.paymentId,
          excessCents,
          excessTreatment: hasExcess
            ? treatment === "REJECT"
              ? "CREDIT"
              : treatment
            : "NONE",
          creditId,
        } satisfies ValidatePaymentResult;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 },
    );
    return result;
  } catch (error) {
    if (error instanceof PaymentError) throw error;
    if (error instanceof CreditError) {
      throw new PaymentError(error.message, "OVERPAYMENT_NOT_ALLOWED");
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2034" || error.message.includes("serialization"))
    ) {
      throw new PaymentError("Conflicto al validar el pago. Intenta nuevamente.", "CONFLICT");
    }
    throw error;
  }
}

export type RejectPaymentResult = {
  paymentId: string;
  cancelledOrders: { orderId: string; orderNumber: string; releasedUnits: number }[];
};

export async function rejectPayment(
  input: RejectPaymentInput,
): Promise<RejectPaymentResult> {
  const reason = input.reason.trim();
  if (reason.length < 5) {
    throw new PaymentError(
      "Indica un motivo de rechazo de al menos 5 caracteres.",
      "INVALID_AMOUNT",
    );
  }

  const prisma = getPrisma();
  try {
    return await prisma.$transaction(
      async (tx) => {
        const payment = await tx.payment.findUnique({
          where: { id: input.paymentId },
          include: { applications: true },
        });
        if (!payment) {
          throw new PaymentError("El pago ya no existe.", "PAYMENT_NOT_FOUND");
        }
        if (payment.status === "VALIDATED") {
          throw new PaymentError(
            "No puedes rechazar un pago ya validado.",
            "ALREADY_VALIDATED",
          );
        }
        if (payment.status === "REJECTED") {
          throw new PaymentError("El pago ya fue rechazado.", "ALREADY_REJECTED");
        }

        await tx.payment.update({
          where: { id: input.paymentId },
          data: {
            status: "REJECTED",
            rejectedAt: new Date(),
            rejectionReason: reason,
            validatedAt: null,
          },
        });

        await auditInTx(tx, input.actorId ?? null, {
          action: "PAYMENT_REJECTED",
          entity: "Payment",
          entityId: input.paymentId,
          metadata: {
            customerId: payment.customerId,
            reason,
            paymentAmount: payment.amount.toString(),
          },
        });

        const cancelledOrders: RejectPaymentResult["cancelledOrders"] = [];
        if (payment.applications.length > 0) {
          const orderIds = Array.from(
            new Set(payment.applications.map((a) => a.orderId)),
          );
          const orders = await tx.order.findMany({
            where: { id: { in: orderIds } },
            select: {
              id: true,
              orderNumber: true,
              status: true,
              validatedPaid: true,
              payments: {
                where: { status: "PENDING" },
                select: { id: true },
              },
            },
          });
          for (const order of orders) {
            const stillHasOtherPending = order.payments.some(
              (p) => p.id !== payment.id,
            );
            const isPaidEnough =
              paymentToCents(order.validatedPaid.toString()) > 0;
            if (
              stillHasOtherPending ||
              isPaidEnough ||
              (order.status !== "PAYMENT_VALIDATION_PENDING" &&
                order.status !== "RESERVED")
            ) {
              continue;
            }
            try {
              const result = await closeUnpaidReservation({
                orderId: order.id,
                reason: "CANCELLED",
                actorId: input.actorId ?? null,
                notes: `Pago rechazado: ${reason}`,
                tx,
              });
              cancelledOrders.push({
                orderId: order.id,
                orderNumber: result.orderNumber,
                releasedUnits: result.releasedUnits,
              });
            } catch (error) {
              if (error instanceof OrderExpiryError) {
                continue;
              }
              throw error;
            }
          }
        }

        return { paymentId: input.paymentId, cancelledOrders };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 15000,
      },
    );
  } catch (error) {
    if (error instanceof PaymentError) throw error;
    if (error instanceof OrderExpiryError) throw error;
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2034" || error.message.includes("serialization"))
    ) {
      throw new PaymentError(
        "Conflicto al rechazar el pago. Intenta nuevamente.",
        "CONFLICT",
      );
    }
    throw error;
  }
}

export async function setPaymentApplications(
  paymentId: string,
  applications: PaymentApplicationInput[],
  options: { actorId?: string | null } = {},
): Promise<void> {
  for (const a of applications) {
    if (!/^\d+(\.\d{1,2})?$/.test(a.amount.trim())) {
      throw new PaymentError("Monto aplicado inválido.", "INVALID_AMOUNT");
    }
    if (paymentToCents(a.amount) <= 0) {
      throw new PaymentError("El monto aplicado debe ser mayor a 0.", "INVALID_AMOUNT");
    }
  }
  const appliedCents = aggregateApplications(applications);

  const prisma = getPrisma();
  try {
    await prisma.$transaction(
      async (tx) => {
        const payment = await tx.payment.findUnique({
          where: { id: paymentId },
          include: { applications: true, customer: { select: { id: true } } },
        });
        if (!payment) {
          throw new PaymentError("El pago ya no existe.", "PAYMENT_NOT_FOUND");
        }
        if (payment.status !== "PENDING") {
          throw new PaymentError(
            "Solo puedes editar aplicaciones de pagos pendientes.",
            "ALREADY_VALIDATED",
          );
        }
        const paymentCents = paymentToCents(payment.amount.toString());
        if (appliedCents > paymentCents) {
          throw new PaymentError(
            "La suma aplicada supera el monto del pago.",
            "INVALID_APPLICATION_SUM",
          );
        }

        if (applications.length > 0) {
          const orderIds = applications.map((a) => a.orderId);
          const uniqueIds = Array.from(new Set(orderIds));
          const orders = await tx.order.findMany({
            where: { id: { in: uniqueIds } },
            select: {
              id: true,
              customerId: true,
              total: true,
              validatedPaid: true,
              balance: true,
              status: true,
            },
          });
          if (orders.length !== uniqueIds.length) {
            throw new PaymentError("Uno de los pedidos ya no existe.", "ORDER_NOT_FOUND");
          }
          const mismatched = orders.find((o) => o.customerId !== payment.customerId);
          if (mismatched) {
            throw new PaymentError(
              "Todos los pedidos deben pertenecer a la misma clienta.",
              "CUSTOMER_MISMATCH",
            );
          }
          for (const app of applications) {
            const order = orders.find((o) => o.id === app.orderId);
            if (!order) continue;
            if (order.status === "CANCELLED" || order.status === "EXPIRED") {
              throw new PaymentError(
                `No puedes aplicar el pago a un pedido ${order.status === "CANCELLED" ? "cancelado" : "vencido"}.`,
                "CUSTOMER_MISMATCH",
              );
            }
            const balance = paymentToCents(order.balance.toString());
            if (paymentToCents(app.amount) > balance) {
              throw new PaymentError(
                `La aplicación al pedido ${app.orderId} (S/${app.amount}) supera su saldo (S/${centsToDecimalString(balance)}).`,
                "ORDER_OVERPAYMENT",
              );
            }
          }
        }

        await tx.paymentApplication.deleteMany({ where: { paymentId } });
        for (const a of applications) {
          await tx.paymentApplication.create({
            data: {
              paymentId,
              orderId: a.orderId,
              amount: centsToDecimalString(paymentToCents(a.amount)),
            },
          });
        }

        await auditInTx(tx, options.actorId ?? null, {
          action: "PAYMENT_APPLICATIONS_UPDATED",
          entity: "Payment",
          entityId: paymentId,
          metadata: { count: applications.length },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 15000,
      },
    );
  } catch (error) {
    if (error instanceof PaymentError) throw error;
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2034" || error.message.includes("serialization"))
    ) {
      throw new PaymentError(
        "Conflicto al actualizar las aplicaciones. Intenta nuevamente.",
        "CONFLICT",
      );
    }
    throw error;
  }
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Pendiente",
  VALIDATED: "Validado",
  REJECTED: "Rechazado",
};

export { PAYMENT_METHOD_LABELS };

export async function getCustomerOpenOrders(customerId: string) {
  const prisma = getPrisma();
  return prisma.order.findMany({
    where: {
      customerId,
      status: { in: ["PAYMENT_VALIDATION_PENDING", "RESERVED", "PARTIALLY_PAID"] },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderNumber: true,
      total: true,
      balance: true,
      status: true,
      createdAt: true,
    },
  });
}

// Reexport for callers needing the engine that creates credits from overpayments.
export { createOverpaymentCredit } from "@/lib/credits";

