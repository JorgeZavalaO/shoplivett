import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

// Las pruebas E2E deben correr contra una base de datos aislada para no
// contaminar la de desarrollo. Si E2E_DATABASE_URL o E2E_DIRECT_URL están
// definidas, las usamos; en caso contrario, caemos a las variables de
// desarrollo (útil para CI cuando se inyectan vía secrets).
const e2eUrl = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;
if (e2eUrl && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = e2eUrl;
}
const e2eDirect = process.env.E2E_DIRECT_URL ?? process.env.DIRECT_URL;
if (e2eDirect && !process.env.DIRECT_URL) {
  process.env.DIRECT_URL = e2eDirect;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL no esta definida para las pruebas E2E.");
}

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const stamp = Date.now();
const TEST_PREFIX = `E2E-${stamp}`;

async function ensureSettings() {
  await prisma.businessSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      reservationDays: 5,
      minimumAdvance: "50.00",
      currency: "PEN",
      freeShippingEnabled: true,
      freeShippingThreshold: "200.00",
      productCodePrefix: "E2E",
      allowOverpaymentCredit: true,
      allowRefund: true,
      enabledPaymentMethods: ["YAPE", "PLIN", "CASH", "OTHER"],
      enabledShippingMethods: [
        "DELIVERY_PROPIO",
        "OLVA",
        "SHALOM",
        "MOTORIZADO",
        "RECOJO",
      ],
      paymentValidatorRoles: ["ADMIN", "SELLER"],
      defaultExchangeRate: "3.7500",
      minimumTargetMarginBps: 1500,
      objectiveTargetMarginBps: 3000,
      defaultCostAllocationMethod: "MIXED",
      mixedValueAllocationPercent: 50,
      mixedWeightAllocationPercent: 50,
      standardPackagingCostPen: "2.00",
      paymentMethodFees: { YAPE: 0, PLIN: 0, CASH: 0, OTHER: 0 },
      enabledSalesChannels: [
        "TIKTOK_LIVE",
        "INSTAGRAM_LIVE",
        "TIENDA",
        "WHATSAPP_DIRECTO",
      ],
    },
  });
}

export async function getAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@shoplivett.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "admin-shoplivett";
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const hashed = await bcrypt.hash(password, 8);
    user = await prisma.user.create({
      data: {
        email,
        name: "Admin E2E",
        role: "ADMIN",
        passwordHash: hashed,
      },
    });
  }
  return { user, password };
}

export async function createTestCustomer(suffix: string) {
  await ensureSettings();
  const phone = `+5199${String(stamp).slice(-6)}${suffix}`;
  const name = `${TEST_PREFIX} Cliente ${suffix}`;
  return prisma.customer.upsert({
    where: { whatsapp: phone },
    update: { name },
    create: {
      name,
      searchName: name.toLowerCase(),
      whatsapp: phone,
      status: "ACTIVE",
      isActive: true,
    },
  });
}

async function getOrCreateCategory() {
  return prisma.category.upsert({
    where: { slug: "e2e-cartera" },
    update: {},
    create: { name: "Cartera E2E", slug: "e2e-cartera", isActive: true },
  });
}

export async function createTestProductWithStock(suffix: string, stock = 5) {
  await ensureSettings();
  const category = await getOrCreateCategory();
  const product = await prisma.product.create({
    data: {
      name: `${TEST_PREFIX} Producto ${suffix}`,
      isActive: true,
      categoryId: category.id,
    },
  });
  const code = `E2E-${stamp}-${suffix}`.slice(0, 32);
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      code,
      price: "100.00",
      cost: "40.00",
      stock,
      reservedStock: 0,
      soldStock: 0,
      status: "ACTIVE",
    },
  });
  await prisma.inventoryMovement.create({
    data: {
      variantId: variant.id,
      type: "IN",
      quantity: stock,
      reason: "E2E seed",
    },
  });
  return variant;
}

export type BatchSeed = {
  variantId: string;
  quantityAvailable: number;
  landedUnitCostPen: string;
  purchaseDate: Date;
};

/**
 * Crea una variante con dos lotes FIFO pre-calculados. El primer lote es
 * más antiguo y más barato, el segundo más reciente y más caro. El stock
 * global se mantiene alineado con la suma disponible por lote.
 */
export async function createTestProductWithBatches(args: {
  suffix: string;
  oldBatch: { quantity: number; unitCost: string };
  newBatch: { quantity: number; unitCost: string };
}) {
  await ensureSettings();
  const category = await getOrCreateCategory();
  const product = await prisma.product.create({
    data: {
      name: `${TEST_PREFIX} Producto ${args.suffix}`,
      isActive: true,
      categoryId: category.id,
    },
  });
  const code = `E2E-${stamp}-${args.suffix}`.slice(0, 32);
  const total =
    args.oldBatch.quantity + args.newBatch.quantity;
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      code,
      price: "100.00",
      cost: args.oldBatch.unitCost,
      stock: total,
      reservedStock: 0,
      soldStock: 0,
      status: "ACTIVE",
    },
  });
  await prisma.inventoryMovement.create({
    data: {
      variantId: variant.id,
      type: "IN",
      quantity: total,
      reason: "E2E seed",
    },
  });

  const oldDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
  const newDate = new Date();
  const created = await prisma.importBatch.create({
    data: {
      code: `E2E-${stamp}-${args.suffix}-A`,
      purchaseDate: oldDate,
      shopper: "E2E shopper",
      agency: "E2E agency",
      totalCostUsd: "0.00",
      totalAdditionalCostsUsd: "0",
      totalAdditionalCostsPen: "0",
      exchangeRate: "3.7500",
      totalInvestmentPen: "0.00",
      status: "COMPLETE",
      distributionMethod: "MIXED",
      lastRecalculatedAt: new Date(),
      createdById: null,
    },
  });
  const createdNew = await prisma.importBatch.create({
    data: {
      code: `E2E-${stamp}-${args.suffix}-B`,
      purchaseDate: newDate,
      shopper: "E2E shopper",
      agency: "E2E agency",
      totalCostUsd: "0.00",
      totalAdditionalCostsUsd: "0",
      totalAdditionalCostsPen: "0",
      exchangeRate: "3.7500",
      totalInvestmentPen: "0.00",
      status: "COMPLETE",
      distributionMethod: "MIXED",
      lastRecalculatedAt: new Date(),
      createdById: null,
    },
  });

  const oldItem = await prisma.importBatchItem.create({
    data: {
      batchId: created.id,
      variantId: variant.id,
      quantityPurchased: args.oldBatch.quantity,
      quantityReceived: args.oldBatch.quantity,
      quantityAvailable: args.oldBatch.quantity,
      unitCostUsd: "0.0000",
      unitCostPen: args.oldBatch.unitCost,
      weight: "0",
      subtotalUsd: "0.00",
      subtotalPen: (
        Number(args.oldBatch.unitCost) * args.oldBatch.quantity
      ).toFixed(2),
      additionalCostPen: "0.0000",
      additionalSubtotalPen: "0.00",
      landedUnitCostPen: args.oldBatch.unitCost,
      landedSubtotalPen: (
        Number(args.oldBatch.unitCost) * args.oldBatch.quantity
      ).toFixed(2),
      distributionBreakdown: undefined,
      calculatedAt: new Date(),
    },
  });
  const newItem = await prisma.importBatchItem.create({
    data: {
      batchId: createdNew.id,
      variantId: variant.id,
      quantityPurchased: args.newBatch.quantity,
      quantityReceived: args.newBatch.quantity,
      quantityAvailable: args.newBatch.quantity,
      unitCostUsd: "0.0000",
      unitCostPen: args.newBatch.unitCost,
      weight: "0",
      subtotalUsd: "0.00",
      subtotalPen: (
        Number(args.newBatch.unitCost) * args.newBatch.quantity
      ).toFixed(2),
      additionalCostPen: "0.0000",
      additionalSubtotalPen: "0.00",
      landedUnitCostPen: args.newBatch.unitCost,
      landedSubtotalPen: (
        Number(args.newBatch.unitCost) * args.newBatch.quantity
      ).toFixed(2),
      distributionBreakdown: undefined,
      calculatedAt: new Date(),
    },
  });

  return { variant, oldItem, newItem };
}

export async function cleanupTestData() {
  await prisma.paymentApplication.deleteMany({
    where: { payment: { customer: { name: { startsWith: TEST_PREFIX } } } },
  });
  await prisma.paymentReceipt.deleteMany({
    where: { payment: { customer: { name: { startsWith: TEST_PREFIX } } } },
  });
  await prisma.payment.deleteMany({
    where: { customer: { name: { startsWith: TEST_PREFIX } } },
  });
  await prisma.customerCredit.deleteMany({
    where: { customer: { name: { startsWith: TEST_PREFIX } } },
  });
  await prisma.shipmentOrder.deleteMany({
    where: { order: { customer: { name: { startsWith: TEST_PREFIX } } } },
  });
  await prisma.shipment.deleteMany({
    where: { customer: { name: { startsWith: TEST_PREFIX } } },
  });
  await prisma.orderItemBatchAllocation.deleteMany({
    where: { orderItem: { order: { customer: { name: { startsWith: TEST_PREFIX } } } } },
  });
  await prisma.orderItem.deleteMany({
    where: { order: { customer: { name: { startsWith: TEST_PREFIX } } } },
  });
  await prisma.order.deleteMany({
    where: { customer: { name: { startsWith: TEST_PREFIX } } },
  });
  await prisma.importBatchItem.deleteMany({
    where: { batch: { code: { startsWith: `E2E-${stamp}-` } } },
  });
  await prisma.importBatch.deleteMany({
    where: { code: { startsWith: `E2E-${stamp}-` } },
  });
  await prisma.inventoryMovement.deleteMany({
    where: { reason: "E2E seed" },
  });
  await prisma.productVariant.deleteMany({
    where: { code: { startsWith: "E2E-" } },
  });
  await prisma.product.deleteMany({
    where: { name: { startsWith: TEST_PREFIX } },
  });
  await prisma.customer.deleteMany({
    where: { name: { startsWith: TEST_PREFIX } },
  });
  await prisma.category.deleteMany({ where: { slug: "e2e-cartera" } });
}

export async function cleanupCustomersByPrefix(prefix: string) {
  await prisma.customer.deleteMany({
    where: { name: { startsWith: prefix } },
  });
}

export { TEST_PREFIX };
