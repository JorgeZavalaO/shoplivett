// Motor de créditos por sobrepago, devoluciones y aplicación manual.

import { Prisma, CreditOrigin, CreditStatus } from "@prisma/client";

import { getPrisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { confirmSaleStock } from "@/lib/inventory";
import { toCents, centsToDecimalString, type Cents } from "@/lib/money";
import { auditInTx } from "@/lib/audit";

export class CreditError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "CREDIT_NOT_FOUND"
      | "CUSTOMER_NOT_FOUND"
      | "ORDER_NOT_FOUND"
      | "INVALID_AMOUNT"
      | "INSUFFICIENT_AVAILABLE"
      | "CUSTOMER_MISMATCH"
      | "CREDIT_NOT_AVAILABLE"
      | "ALREADY_REFUNDED"
      | "CONFLICT",
  ) {
    super(message);
    this.name = "CreditError";
  }
}

function creditToCents(value: string): Cents {
  try {
    return toCents(value, { allowNegative: true });
  } catch {
    throw new CreditError("Monto inválido.", "INVALID_AMOUNT");
  }
}

export type CreateOverpaymentCreditInput = {
  customerId: string;
  paymentId: string;
  amount: string;
  notes?: string | null;
  createdById?: string | null;
};

export async function createOverpaymentCredit(
  input: CreateOverpaymentCreditInput,
): Promise<{ creditId: string }> {
  const cents = creditToCents(input.amount);
  if (cents <= 0) {
    throw new CreditError("El monto del crédito debe ser mayor a 0.", "INVALID_AMOUNT");
  }
  const settings = await getSettings();
  if (!settings.allowOverpaymentCredit) {
    throw new CreditError(
      "La configuración no permite crear créditos por sobrepago.",
      "INVALID_AMOUNT",
    );
  }

  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({ where: { id: input.customerId } });
    if (!customer) throw new CreditError("La clienta ya no existe.", "CUSTOMER_NOT_FOUND");

    const payment = await tx.payment.findUnique({ where: { id: input.paymentId } });
    if (!payment) throw new CreditError("El pago ya no existe.", "CREDIT_NOT_FOUND");
    if (payment.customerId !== input.customerId) {
      throw new CreditError("El pago no pertenece a la clienta.", "CUSTOMER_MISMATCH");
    }

    const credit = await tx.customerCredit.create({
      data: {
        customerId: input.customerId,
        paymentId: input.paymentId,
        origin: CreditOrigin.OVERPAYMENT,
        status: CreditStatus.AVAILABLE,
        amount: centsToDecimalString(cents),
        availableAmount: centsToDecimalString(cents),
        notes: input.notes ?? null,
        createdById: input.createdById ?? null,
      },
    });

    await auditInTx(tx, input.createdById ?? null, {
      action: "CREDIT_CREATED",
      entity: "CustomerCredit",
      entityId: credit.id,
      metadata: { origin: "OVERPAYMENT", customerId: input.customerId },
    });

    return { creditId: credit.id };
  });
}

export type CreateManualCreditInput = {
  customerId: string;
  amount: string;
  notes?: string | null;
  createdById?: string | null;
};

export async function createManualCredit(
  input: CreateManualCreditInput,
): Promise<{ creditId: string }> {
  const cents = creditToCents(input.amount);
  if (cents <= 0) {
    throw new CreditError("El monto del crédito debe ser mayor a 0.", "INVALID_AMOUNT");
  }
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({ where: { id: input.customerId } });
    if (!customer) throw new CreditError("La clienta ya no existe.", "CUSTOMER_NOT_FOUND");
    const credit = await tx.customerCredit.create({
      data: {
        customerId: input.customerId,
        origin: CreditOrigin.MANUAL,
        status: CreditStatus.AVAILABLE,
        amount: centsToDecimalString(cents),
        availableAmount: centsToDecimalString(cents),
        notes: input.notes ?? null,
        createdById: input.createdById ?? null,
      },
    });
    await auditInTx(tx, input.createdById ?? null, {
      action: "CREDIT_CREATED",
      entity: "CustomerCredit",
      entityId: credit.id,
      metadata: { origin: "MANUAL", customerId: input.customerId },
    });
    return { creditId: credit.id };
  });
}

export type RefundCreditInput = {
  creditId: string;
  reason: string;
  refundedById?: string | null;
};

export async function refundCredit(
  input: RefundCreditInput,
): Promise<{ creditId: string }> {
  const reason = input.reason.trim();
  if (reason.length < 5) {
    throw new CreditError(
      "Indica el motivo de devolución (mínimo 5 caracteres).",
      "INVALID_AMOUNT",
    );
  }
  const settings = await getSettings();
  if (!settings.allowRefund) {
    throw new CreditError(
      "La configuración no permite registrar devoluciones.",
      "INVALID_AMOUNT",
    );
  }
  const prisma = getPrisma();
  try {
    return await prisma.$transaction(
      async (tx) => {
        const credit = await tx.customerCredit.findUnique({ where: { id: input.creditId } });
        if (!credit) throw new CreditError("El crédito ya no existe.", "CREDIT_NOT_FOUND");
        if (credit.status === CreditStatus.REFUNDED) {
          throw new CreditError("El crédito ya fue devuelto.", "ALREADY_REFUNDED");
        }
        if (credit.status === CreditStatus.VOIDED) {
          throw new CreditError("El crédito está anulado.", "CREDIT_NOT_AVAILABLE");
        }
        const available = creditToCents(credit.availableAmount.toString());
        if (available > 0) {
          throw new CreditError(
            "Solo puedes devolver créditos que ya se usaron por completo.",
            "CREDIT_NOT_AVAILABLE",
          );
        }
        await tx.customerCredit.update({
          where: { id: input.creditId },
          data: {
            status: CreditStatus.REFUNDED,
            refundedAt: new Date(),
            refundedById: input.refundedById ?? null,
            refundReason: reason,
          },
        });
        await auditInTx(tx, input.refundedById ?? null, {
          action: "CREDIT_REFUNDED",
          entity: "CustomerCredit",
          entityId: input.creditId,
          metadata: { reason },
        });
        return { creditId: input.creditId };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 },
    );
  } catch (error) {
    if (error instanceof CreditError) throw error;
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2034" || error.message.includes("serialization"))
    ) {
      throw new CreditError("Conflicto al devolver el crédito. Intenta nuevamente.", "CONFLICT");
    }
    throw error;
  }
}

export type ApplyCreditToOrderInput = {
  creditId: string;
  orderId: string;
  amount: string;
  createdById?: string | null;
};

export type ApplyCreditResult = {
  applicationId: string;
  remainingOrderBalance: string;
  creditAvailableAfter: string;
};

/**
 * Aplica manualmente un crédito a un pedido de la misma clienta.
 * El monto se abona al `validatedPaid` del pedido y se descuenta del crédito.
 * No confirma stock reservado → vendido (esa lógica corresponde a un pago
 * validado; un crédito aplicado a un pedido ya pagado o a un pedido
 * parcialmente pagado recalcula estado y, si queda PAID, mueve stock).
 */
export async function applyCreditToOrder(
  input: ApplyCreditToOrderInput,
): Promise<ApplyCreditResult> {
  const cents = creditToCents(input.amount);
  if (cents <= 0) {
    throw new CreditError("El monto a aplicar debe ser mayor a 0.", "INVALID_AMOUNT");
  }
  const prisma = getPrisma();
  try {
    return await prisma.$transaction(
      async (tx) => {
        const credit = await tx.customerCredit.findUnique({
          where: { id: input.creditId },
        });
        if (!credit) throw new CreditError("El crédito ya no existe.", "CREDIT_NOT_FOUND");
        if (credit.status === CreditStatus.REFUNDED) {
          throw new CreditError("El crédito fue devuelto.", "CREDIT_NOT_AVAILABLE");
        }
        if (credit.status === CreditStatus.VOIDED) {
          throw new CreditError("El crédito está anulado.", "CREDIT_NOT_AVAILABLE");
        }
        if (credit.status === CreditStatus.USED) {
          throw new CreditError("El crédito ya se usó por completo.", "CREDIT_NOT_AVAILABLE");
        }
        const available = creditToCents(credit.availableAmount.toString());
        if (cents > available) {
          throw new CreditError(
            `El crédito solo tiene S/${centsToDecimalString(available)} disponible.`,
            "INSUFFICIENT_AVAILABLE",
          );
        }

        const order = await tx.order.findUnique({
          where: { id: input.orderId },
          select: {
            id: true,
            customerId: true,
            total: true,
            validatedPaid: true,
            balance: true,
            status: true,
          },
        });
        if (!order) throw new CreditError("El pedido ya no existe.", "ORDER_NOT_FOUND");
        if (order.customerId !== credit.customerId) {
          throw new CreditError(
            "El pedido no pertenece a la misma clienta del crédito.",
            "CUSTOMER_MISMATCH",
          );
        }
        if (order.status === "CANCELLED" || order.status === "EXPIRED") {
          throw new CreditError(
            "No puedes aplicar crédito a un pedido cancelado o vencido.",
            "CREDIT_NOT_AVAILABLE",
          );
        }
        const orderBalance = creditToCents(order.balance.toString());
        if (orderBalance <= 0) {
          throw new CreditError(
            "El pedido ya está pagado y no admite más aplicaciones.",
            "INVALID_AMOUNT",
          );
        }
        const effective = Math.min(cents, orderBalance);

        const newValidated = creditToCents(order.validatedPaid.toString()) + effective;
        const newBalance = creditToCents(order.total.toString()) - newValidated;
        const balance = newBalance < 0 ? 0 : newBalance;
        const validated = newValidated > creditToCents(order.total.toString())
          ? creditToCents(order.total.toString())
          : newValidated;
        let newStatus: "PAID" | "PARTIALLY_PAID" | "RESERVED";
        if (validated >= creditToCents(order.total.toString())) {
          newStatus = "PAID";
        } else if (validated > 0) {
          newStatus = "PARTIALLY_PAID";
        } else {
          newStatus = "RESERVED";
        }

        await tx.order.update({
          where: { id: order.id },
          data: {
            validatedPaid: centsToDecimalString(validated),
            balance: centsToDecimalString(balance),
            status: newStatus,
          },
        });

        const newCreditAvailable = available - effective;
        const newCreditStatus =
          newCreditAvailable <= 0 ? CreditStatus.USED : CreditStatus.PARTIALLY_USED;
        await tx.customerCredit.update({
          where: { id: credit.id },
          data: {
            availableAmount: centsToDecimalString(Math.max(0, newCreditAvailable)),
            status: newCreditStatus,
          },
        });

        const application = await tx.customerCreditApplication.create({
          data: {
            creditId: credit.id,
            orderId: order.id,
            amount: centsToDecimalString(effective),
            createdById: input.createdById ?? null,
          },
        });

        await auditInTx(tx, input.createdById ?? null, {
          action: "CREDIT_APPLIED",
          entity: "CustomerCredit",
          entityId: credit.id,
          metadata: {
            orderId: order.id,
            amount: centsToDecimalString(effective),
            applicationId: application.id,
          },
        });

        // Si con el crédito el pedido quedó pagado, mover stock reservado → vendido.
        if (newStatus === "PAID") {
          const items = await tx.orderItem.findMany({
            where: { orderId: order.id },
            select: { variantId: true, quantity: true },
          });
          for (const item of items) {
            await confirmSaleStock(item.variantId, item.quantity, {
              reason: `Crédito ${credit.id} aplicado a pedido`,
              tx,
            });
          }
        }

        return {
          applicationId: application.id,
          remainingOrderBalance: centsToDecimalString(balance),
          creditAvailableAfter: centsToDecimalString(Math.max(0, newCreditAvailable)),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 },
    );
  } catch (error) {
    if (error instanceof CreditError) throw error;
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2034" || error.message.includes("serialization"))
    ) {
      throw new CreditError("Conflicto al aplicar el crédito. Intenta nuevamente.", "CONFLICT");
    }
    throw error;
  }
}

export async function getCustomerAvailableCredit(customerId: string): Promise<string> {
  const prisma = getPrisma();
  const result = await prisma.customerCredit.aggregate({
    where: {
      customerId,
      status: { in: [CreditStatus.AVAILABLE, CreditStatus.PARTIALLY_USED] },
    },
    _sum: { availableAmount: true },
  });
  const sum = result._sum.availableAmount;
  if (!sum) return "0.00";
  return centsToDecimalString(creditToCents(sum.toString()));
}

export async function listCustomerCredits(customerId: string) {
  const prisma = getPrisma();
  const credits = await prisma.customerCredit.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    include: {
      applications: {
        include: {
          order: { select: { id: true, orderNumber: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      payment: {
        select: { id: true, method: true, amount: true, createdAt: true },
      },
    },
  });
  return credits.map((c) => ({
    id: c.id,
    origin: c.origin,
    status: c.status,
    amount: c.amount.toString(),
    availableAmount: c.availableAmount.toString(),
    notes: c.notes,
    createdAt: c.createdAt,
    refundedAt: c.refundedAt,
    refundReason: c.refundReason,
    payment: c.payment
      ? {
          id: c.payment.id,
          method: c.payment.method,
          amount: c.payment.amount.toString(),
          createdAt: c.payment.createdAt,
        }
      : null,
    applications: c.applications.map((a) => ({
      id: a.id,
      orderId: a.orderId,
      orderNumber: a.order.orderNumber,
      amount: a.amount.toString(),
      createdAt: a.createdAt,
    })),
  }));
}

export type CreditListItem = Awaited<ReturnType<typeof listCustomerCredits>>[number];

