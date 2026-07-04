// Test de regresión AUD-UX-009: `createQuickSale` debe rechazar ventas a
// clientas con `status = BLOCKED`, tanto en la lectura inicial como en la
// revalidación dentro de la transacción Serializable.
//
// Se ejecuta con: pnpm tsx scripts/_with-env.ts scripts/test-customer-blocked-sale.ts
// Corre contra la base de datos real porque `createQuickSale` usa
// transacciones Prisma reales.

import assert from "node:assert/strict";

import { prisma } from "../lib/prisma";
import { createQuickSale, OrderError } from "../lib/sales";

let passed = 0;
let failed = 0;

async function run(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  fail ${name}`);
    console.error(error);
  }
}

async function ensureCategory() {
  return prisma.category.upsert({
    where: { slug: "blocked-sale-test" },
    update: {},
    create: { name: "Blocked Sale Test", slug: "blocked-sale-test", isActive: true },
  });
}

async function ensureVariant(categoryId: string, stamp: number) {
  const product = await prisma.product.create({
    data: {
      name: `Blocked Sale Product ${stamp}`,
      isActive: true,
      categoryId,
    },
  });
  return prisma.productVariant.create({
    data: {
      productId: product.id,
      code: `BLK-${stamp}`.slice(0, 32),
      price: "50.00",
      cost: "10.0000",
      stock: 5,
      reservedStock: 0,
      soldStock: 0,
      status: "ACTIVE",
    },
  });
}

async function ensureCustomer(
  status: "ACTIVE" | "BLOCKED",
  stamp: number,
) {
  const phone = `+5198${String(stamp).slice(-9)}`;
  return prisma.customer.create({
    data: {
      name: `Blocked Test ${status} ${stamp}`,
      searchName: `blocked test ${status.toLowerCase()} ${stamp}`,
      whatsapp: phone,
      status,
      isActive: true,
    },
  });
}

async function main() {
  const stamp = Date.now();
  const category = await ensureCategory();

  console.log("AUD-UX-009: cliente BLOCKED no puede comprar\n");

  const blockedCustomer = await ensureCustomer("BLOCKED", stamp);
  const variantForBlocked = await ensureVariant(category.id, stamp);

  await run("createQuickSale rechaza cliente BLOCKED con OrderError CUSTOMER_BLOCKED", async () => {
    await assert.rejects(
      () =>
        createQuickSale({
          customerId: blockedCustomer.id,
          items: [{ variantId: variantForBlocked.id, quantity: 1 }],
          discount: "0",
          shippingAmount: "0",
          advanceAmount: "50",
          paymentMethod: "CASH",
        }),
      (error: unknown) => {
        assert.ok(error instanceof OrderError, "debe lanzar OrderError");
        assert.equal((error as OrderError).code, "CUSTOMER_BLOCKED");
        return true;
      },
    );
  });

  await run("no se crea ningún pedido para el cliente BLOCKED", async () => {
    const count = await prisma.order.count({
      where: { customerId: blockedCustomer.id },
    });
    assert.equal(count, 0);
  });

  await run("no se reserva stock del cliente BLOCKED (stock intacto)", async () => {
    const fresh = await prisma.productVariant.findUniqueOrThrow({
      where: { id: variantForBlocked.id },
    });
    assert.equal(fresh.reservedStock, 0);
    assert.equal(fresh.stock, 5);
  });

  // --- Control: un cliente ACTIVE sí puede comprar (evita over-blocking) ---
  const activeCustomer = await ensureCustomer("ACTIVE", stamp + 1);
  const variantForActive = await ensureVariant(category.id, stamp + 1);

  await run("createQuickSale permite cliente ACTIVE (no bloquea de más)", async () => {
    const result = await createQuickSale({
      customerId: activeCustomer.id,
      items: [{ variantId: variantForActive.id, quantity: 1 }],
      discount: "0",
      shippingAmount: "0",
      advanceAmount: "50",
      paymentMethod: "CASH",
    });
    assert.ok(result.orderId);
  });

  // --- Limpieza ---
  await prisma.orderItemBatchAllocation.deleteMany({
    where: { variantId: { in: [variantForBlocked.id, variantForActive.id] } },
  });
  await prisma.paymentApplication.deleteMany({
    where: { order: { customerId: { in: [blockedCustomer.id, activeCustomer.id] } } },
  });
  await prisma.payment.deleteMany({
    where: { customerId: { in: [blockedCustomer.id, activeCustomer.id] } },
  });
  await prisma.orderItem.deleteMany({
    where: { variantId: { in: [variantForBlocked.id, variantForActive.id] } },
  });
  await prisma.order.deleteMany({
    where: { customerId: { in: [blockedCustomer.id, activeCustomer.id] } },
  });
  await prisma.productVariant.deleteMany({
    where: { id: { in: [variantForBlocked.id, variantForActive.id] } },
  });
  await prisma.product.deleteMany({
    where: { name: { startsWith: "Blocked Sale Product" } },
  });
  await prisma.customer.deleteMany({
    where: { id: { in: [blockedCustomer.id, activeCustomer.id] } },
  });
  await prisma.category.deleteMany({ where: { slug: "blocked-sale-test" } });

  console.log(`\nTotal: ${passed} ok / ${failed} fail`);
  await prisma.$disconnect();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
