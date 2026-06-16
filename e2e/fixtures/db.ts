import { PrismaClient } from "@prisma/client";
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

export const prisma = new PrismaClient();

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

export async function createTestProductWithStock(suffix: string, stock = 5) {
  await ensureSettings();
  const category = await prisma.category.upsert({
    where: { slug: "e2e-cartera" },
    update: {},
    create: { name: "Cartera E2E", slug: "e2e-cartera", isActive: true },
  });
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
  await prisma.orderItem.deleteMany({
    where: { order: { customer: { name: { startsWith: TEST_PREFIX } } } },
  });
  await prisma.order.deleteMany({
    where: { customer: { name: { startsWith: TEST_PREFIX } } },
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

export { TEST_PREFIX };
