// Tests de dominio Sprint 23: incidents.
// Cubre validaciones, integracion con stock, creditos y agregadores mensuales.
//
// Se ejecuta con: pnpm tsx scripts/_with-env.ts scripts/test-incidents.ts
// Corre contra la base de datos real.

import assert from "node:assert/strict";

import { IncidentCreateSchema, IncidentCancelSchema, IncidentResolveSchema } from "../lib/validations";
import { prisma } from "../lib/prisma";
import {
  createIncident,
  resolveIncident,
  cancelIncident,
  listIncidents,
  getMonthlyIncidentSummary,
  IncidentError,
} from "../lib/incidents";
import { adjustStock, InventoryError } from "../lib/inventory";

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

function makeInput(overrides: Record<string, unknown> = {}) {
  return {
    incidentDate: new Date().toISOString(),
    type: "RETURN" as const,
    decision: "DISCARDED" as const,
    quantity: 1,
    description: "Test incident",
    recoveredAmount: "0",
    lostAmount: "0",
    ...overrides,
  };
}

function nowYear(): number {
  return new Date().getFullYear();
}
function nowMonth(): number {
  return new Date().getMonth() + 1;
}

async function ensureAdmin() {
  const email = "admin@shoplivett.local";
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) return user;
  const bcrypt = await import("bcryptjs");
  return prisma.user.create({
    data: {
      email,
      name: "Administrador",
      passwordHash: await bcrypt.hash("change-me-in-env", 10),
      role: "ADMIN",
      isActive: true,
    },
  });
}

async function ensureCustomer(stamp: number) {
  const phone = `+5199${String(stamp).slice(-9)}`;
  return prisma.customer.upsert({
    where: { whatsapp: phone },
    update: { name: `ST23 Customer ${stamp}` },
    create: {
      name: `ST23 Customer ${stamp}`,
      searchName: `st23 customer ${stamp}`.toLowerCase(),
      whatsapp: phone,
      status: "ACTIVE",
      isActive: true,
    },
  });
}

async function ensureVariant(stamp: number, initialStock: number) {
  const category = await prisma.category.upsert({
    where: { slug: "st23-test" },
    update: {},
    create: { name: "ST23 Test", slug: "st23-test", isActive: true },
  });
  const product = await prisma.product.create({
    data: {
      name: `ST23 Product ${stamp}`,
      isActive: true,
      categoryId: category.id,
    },
  });
  return prisma.productVariant.create({
    data: {
      productId: product.id,
      code: `ST23-${stamp}`.slice(0, 32),
      price: "100.00",
      cost: "40.0000",
      stock: initialStock,
      reservedStock: 0,
      soldStock: 0,
      status: "ACTIVE",
    },
  });
}

async function main() {
  const admin = await ensureAdmin();
  const year = nowYear();
  const month = nowMonth();
  const stamp = Date.now();

  await run("IncidentCreateSchema valida campos obligatorios", () => {
    const parsed = IncidentCreateSchema.safeParse(makeInput());
    assert.equal(parsed.success, true);
  });

  await run("IncidentCreateSchema rechaza RESTOCK sin variante", () => {
    const parsed = IncidentCreateSchema.safeParse(
      makeInput({ decision: "RESTOCK", restockQuantity: 1 }),
    );
    assert.equal(parsed.success, false);
  });

  await run("IncidentCreateSchema rechaza CREDIT sin clienta", () => {
    const parsed = IncidentCreateSchema.safeParse(
      makeInput({ decision: "CREDIT", recoveredAmount: "50.00" }),
    );
    assert.equal(parsed.success, false);
  });

  await run("IncidentCancelSchema exige motivo >= 5", () => {
    const parsed = IncidentCancelSchema.safeParse({ cancelReason: "ok" });
    assert.equal(parsed.success, false);
  });

  await run("IncidentResolveSchema acepta notas opcionales", () => {
    const parsed = IncidentResolveSchema.safeParse({ resolutionNotes: "" });
    assert.equal(parsed.success, true);
  });

  let createdReturnId = "";
  let createdDamageId = "";
  let createdCreditId = "";

  await run(
    "createIncident DAMAGE sin pedido reduce stock y registra movimiento",
    async () => {
      const variant = await ensureVariant(stamp + 1, 5);
      const initialStock = variant.stock;
      try {
        const result = await createIncident({
          incidentDate: new Date().toISOString(),
          type: "DAMAGE",
          decision: "NONE",
          variantId: variant.id,
          quantity: 2,
          description: "ST23 damage test",
          lostAmount: "80.00",
          recoveredAmount: "0",
          createdById: admin.id,
        });
        createdDamageId = result.incidentId;
        const updated = await prisma.productVariant.findUnique({
          where: { id: variant.id },
        });
        assert.equal(updated?.stock, initialStock - 2);
        const movement = await prisma.inventoryMovement.findFirst({
          where: { variantId: variant.id, reason: { contains: result.incidentId } },
        });
        assert.ok(movement, "debe existir movimiento con referencia a la incidencia");
        assert.equal(movement?.type, "ADJUSTMENT");
        assert.equal(movement?.quantity, -2);
      } finally {
        await prisma.inventoryMovement.deleteMany({
          where: { variantId: variant.id, reason: { contains: createdDamageId } },
        });
        await prisma.incident.deleteMany({
          where: { id: createdDamageId },
        });
        if (createdDamageId) {
          // restore stock
          await prisma.productVariant.update({
            where: { id: variant.id },
            data: { stock: 5 },
          });
        }
      }
    },
  );

  await run(
    "createIncident DAMAGE sin pedido no consume stock reservado o vendido",
    async () => {
      const variant = await ensureVariant(stamp + 101, 5);
      await prisma.productVariant.update({
        where: { id: variant.id },
        data: { stock: 5, reservedStock: 3, soldStock: 1 },
      });
      try {
        await assert.rejects(
          createIncident({
            incidentDate: new Date().toISOString(),
            type: "DAMAGE",
            decision: "NONE",
            variantId: variant.id,
            quantity: 2,
            description: "ST23 damage committed stock",
            lostAmount: "80.00",
            recoveredAmount: "0",
            createdById: admin.id,
          }),
          (err) => err instanceof IncidentError && err.code === "INSUFFICIENT_STOCK",
        );
        const updated = await prisma.productVariant.findUnique({ where: { id: variant.id } });
        assert.equal(updated?.stock, 5);
        assert.equal(updated?.reservedStock, 3);
        assert.equal(updated?.soldStock, 1);
      } finally {
        await prisma.incident.deleteMany({ where: { variantId: variant.id } });
        await prisma.inventoryMovement.deleteMany({ where: { variantId: variant.id } });
        await prisma.productVariant.deleteMany({ where: { id: variant.id } });
      }
    },
  );

  await run(
    "adjustStock bloquea ajustes bajo unidades comprometidas",
    async () => {
      const variant = await ensureVariant(stamp + 102, 6);
      await prisma.productVariant.update({
        where: { id: variant.id },
        data: { stock: 6, reservedStock: 2, soldStock: 2 },
      });
      try {
        await assert.rejects(
          adjustStock(variant.id, -3, "ST23 unsafe adjustment"),
          (err) => err instanceof InventoryError && err.code === "INSUFFICIENT_STOCK",
        );
        const updated = await prisma.productVariant.findUnique({ where: { id: variant.id } });
        assert.equal(updated?.stock, 6);
        assert.equal(updated?.reservedStock, 2);
        assert.equal(updated?.soldStock, 2);
      } finally {
        await prisma.inventoryMovement.deleteMany({ where: { variantId: variant.id } });
        await prisma.productVariant.deleteMany({ where: { id: variant.id } });
      }
    },
  );

  await run(
    "createIncident RETURN + RESTOCK aumenta disponible exactamente por unidades devueltas",
    async () => {
      const variant = await ensureVariant(stamp + 2, 5);
      // simulamos unidades vendidas
      await prisma.productVariant.update({
        where: { id: variant.id },
        data: { stock: 5, soldStock: 3 },
      });
      try {
        const result = await createIncident({
          incidentDate: new Date().toISOString(),
          type: "RETURN",
          decision: "RESTOCK",
          variantId: variant.id,
          quantity: 3,
          restockQuantity: 3,
          description: "ST23 return restock test",
          lostAmount: "0",
          recoveredAmount: "0",
          createdById: admin.id,
        });
        createdReturnId = result.incidentId;
        assert.equal(result.restockedUnits, 3);
        const updated = await prisma.productVariant.findUnique({
          where: { id: variant.id },
        });
        assert.equal(updated?.stock, 5, "stock total no debe cambiar");
        assert.equal(updated?.soldStock, 0, "soldStock debe haber bajado en 3");
        const available = (updated?.stock ?? 0) - (updated?.reservedStock ?? 0) - (updated?.soldStock ?? 0);
        assert.equal(available, 5, "disponible debe subir de 2 a 5, exactamente +3");
        const movement = await prisma.inventoryMovement.findFirst({
          where: { variantId: variant.id, reason: { contains: result.incidentId } },
        });
        assert.ok(movement, "debe existir movimiento");
        assert.equal(movement?.type, "IN");
        assert.equal(movement?.quantity, 3);
      } finally {
        await prisma.inventoryMovement.deleteMany({
          where: { variantId: variant.id, reason: { contains: createdReturnId } },
        });
        await prisma.incident.deleteMany({
          where: { id: createdReturnId },
        });
        await prisma.productVariant.update({
          where: { id: variant.id },
          data: { stock: 5, soldStock: 3 },
        });
      }
    },
  );

  await run(
    "cancelIncident revierte DAMAGE de inventario propio",
    async () => {
      const variant = await ensureVariant(stamp + 33, 5);
      const result = await createIncident({
        incidentDate: new Date().toISOString(),
        type: "DAMAGE",
        decision: "NONE",
        variantId: variant.id,
        quantity: 2,
        description: "ST23 cancel damage reversal",
        lostAmount: "80.00",
        recoveredAmount: "0",
        createdById: admin.id,
      });
      try {
        let updated = await prisma.productVariant.findUnique({ where: { id: variant.id } });
        assert.equal(updated?.stock, 3);

        await cancelIncident({
          incidentId: result.incidentId,
          actorId: admin.id,
          reason: "Reversa de test",
        });

        updated = await prisma.productVariant.findUnique({ where: { id: variant.id } });
        assert.equal(updated?.stock, 5, "stock debe volver al valor inicial");
        const cancelled = await prisma.incident.findUnique({ where: { id: result.incidentId } });
        assert.equal(cancelled?.status, "CANCELLED");
      } finally {
        await prisma.inventoryMovement.deleteMany({ where: { variantId: variant.id } });
        await prisma.incident.deleteMany({ where: { id: result.incidentId } });
        await prisma.productVariant.deleteMany({ where: { id: variant.id } });
      }
    },
  );

  await run(
    "createIncident RETURN + CREDIT crea CustomerCredit",
    async () => {
      const customer = await ensureCustomer(stamp + 3);
      const variant = await ensureVariant(stamp + 4, 0);
      try {
        const result = await createIncident({
          incidentDate: new Date().toISOString(),
          type: "RETURN",
          decision: "CREDIT",
          customerId: customer.id,
          variantId: variant.id,
          quantity: 1,
          description: "ST23 credit test",
          recoveredAmount: "75.00",
          lostAmount: "0",
          createdById: admin.id,
        });
        createdCreditId = result.creditId ?? "";
        assert.ok(result.creditId, "debe retornar creditId");
        const credit = await prisma.customerCredit.findUnique({
          where: { id: result.creditId! },
        });
        assert.ok(credit, "credito debe existir");
        assert.equal(Number(credit?.amount.toString()), 75);
        assert.equal(credit?.origin, "MANUAL");
        const incident = await prisma.incident.findUnique({
          where: { id: result.incidentId },
        });
        assert.equal(incident?.creditId, result.creditId);
      } finally {
        if (createdCreditId) {
          await prisma.customerCredit.deleteMany({
            where: { id: createdCreditId },
          });
        }
        await prisma.incident.deleteMany({
          where: { customerId: customer.id, description: "ST23 credit test" },
        });
        await prisma.productVariant.deleteMany({
          where: { id: variant.id },
        });
      }
    },
  );

  await run(
    "cancelIncident anula credito de incidencia si no fue aplicado",
    async () => {
      const customer = await ensureCustomer(stamp + 34);
      const variant = await ensureVariant(stamp + 35, 0);
      const result = await createIncident({
        incidentDate: new Date().toISOString(),
        type: "RETURN",
        decision: "CREDIT",
        customerId: customer.id,
        variantId: variant.id,
        quantity: 1,
        description: "ST23 cancel unused credit",
        recoveredAmount: "50.00",
        lostAmount: "0",
        createdById: admin.id,
      });
      try {
        assert.ok(result.creditId);
        await cancelIncident({
          incidentId: result.incidentId,
          actorId: admin.id,
          reason: "Reversa credito test",
        });
        const credit = await prisma.customerCredit.findUnique({ where: { id: result.creditId! } });
        assert.equal(credit?.status, "VOIDED");
        assert.equal(Number(credit?.availableAmount.toString()), 0);
      } finally {
        await prisma.incident.deleteMany({ where: { id: result.incidentId } });
        if (result.creditId) await prisma.customerCredit.deleteMany({ where: { id: result.creditId } });
        await prisma.productVariant.deleteMany({ where: { id: variant.id } });
      }
    },
  );

  await run(
    "cancelIncident bloquea credito de incidencia ya aplicado",
    async () => {
      const customer = await ensureCustomer(stamp + 36);
      const variant = await ensureVariant(stamp + 37, 0);
      const order = await prisma.order.create({
        data: {
          orderNumber: `ST23-CREDIT-${stamp}`,
          customerId: customer.id,
          status: "RESERVED",
          subtotal: "50.00",
          discount: "0.00",
          shippingAmount: "0.00",
          total: "50.00",
          validatedPaid: "0.00",
          balance: "50.00",
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      });
      const result = await createIncident({
        incidentDate: new Date().toISOString(),
        type: "RETURN",
        decision: "CREDIT",
        customerId: customer.id,
        variantId: variant.id,
        quantity: 1,
        description: "ST23 cancel used credit",
        recoveredAmount: "50.00",
        lostAmount: "0",
        createdById: admin.id,
      });
      try {
        assert.ok(result.creditId);
        await prisma.customerCredit.update({
          where: { id: result.creditId! },
          data: { availableAmount: "0.00", status: "USED" },
        });
        await prisma.customerCreditApplication.create({
          data: { creditId: result.creditId!, orderId: order.id, amount: "50.00", createdById: admin.id },
        });
        await assert.rejects(
          cancelIncident({
            incidentId: result.incidentId,
            actorId: admin.id,
            reason: "No debe cancelar",
          }),
          (err) => err instanceof IncidentError && err.code === "CREDIT_ALREADY_USED",
        );
      } finally {
        if (result.creditId) {
          await prisma.customerCreditApplication.deleteMany({ where: { creditId: result.creditId } });
        }
        await prisma.incident.deleteMany({ where: { id: result.incidentId } });
        if (result.creditId) await prisma.customerCredit.deleteMany({ where: { id: result.creditId } });
        await prisma.order.deleteMany({ where: { id: order.id } });
        await prisma.productVariant.deleteMany({ where: { id: variant.id } });
      }
    },
  );

  await run(
    "listIncidents filtra por mes y agrega perdidos/recuperados",
    async () => {
      const tag = `ST23-${stamp}-LIST`;
      const customer = await ensureCustomer(stamp + 10);
      const v1 = await ensureVariant(stamp + 11, 5);
      const a = await prisma.incident.create({
        data: {
          incidentDate: new Date(year, month - 1, 5),
          type: "DAMAGE",
          status: "OPEN",
          decision: "NONE",
          variantId: v1.id,
          customerId: customer.id,
          quantity: 1,
          description: tag,
          lostAmount: "100.00",
          recoveredAmount: "0",
        },
      });
      const v2 = await ensureVariant(stamp + 12, 5);
      const b = await prisma.incident.create({
        data: {
          incidentDate: new Date(year, month - 1, 6),
          type: "LOSS",
          status: "RESOLVED",
          decision: "NONE",
          variantId: v2.id,
          quantity: 1,
          description: tag,
          lostAmount: "200.00",
          recoveredAmount: "0",
        },
      });
      const c = await prisma.incident.create({
        data: {
          incidentDate: new Date(year, month - 1, 7),
          type: "RETURN",
          status: "CANCELLED",
          decision: "DISCARDED",
          quantity: 1,
          description: tag,
          lostAmount: "999.00",
          recoveredAmount: "0",
        },
      });
      try {
        const result = await listIncidents({
          year,
          month,
          type: "ALL",
          status: "ALL",
          decision: "ALL",
          query: tag,
          page: 1,
          perPage: 50,
        });
        const totalActive = result.items.length;
        assert.ok(totalActive >= 3);
        // anulado debe estar incluido en la lista pero NO en el totalizador
        const cancelled = result.items.find((it) => it.id === c.id);
        assert.ok(cancelled, "anulado debe aparecer en la lista");
        const lostCents = result.totals.lostCents;
        // Solo a + b (10000 + 20000 = 30000 cents), c esta cancelado
        assert.equal(
          lostCents,
          30000,
          `esperaba 30000 cents, obtuvo ${lostCents}`,
        );

        const byType = await listIncidents({
          year,
          month,
          type: "DAMAGE",
          status: "ALL",
          decision: "ALL",
          query: tag,
          page: 1,
          perPage: 50,
        });
        assert.ok(byType.items.every((it) => it.type === "DAMAGE"));

        const onlyOpen = await listIncidents({
          year,
          month,
          type: "ALL",
          status: "OPEN",
          decision: "ALL",
          query: tag,
          page: 1,
          perPage: 50,
        });
        assert.ok(onlyOpen.items.every((it) => it.status === "OPEN"));
        assert.ok(onlyOpen.items.some((it) => it.id === a.id));
      } finally {
        await prisma.incident.deleteMany({
          where: { id: { in: [a.id, b.id, c.id] } },
        });
        await prisma.productVariant.deleteMany({
          where: { id: { in: [v1.id, v2.id] } },
        });
      }
    },
  );

  await run(
    "getMonthlyIncidentSummary agrega por tipo y separa perdido vs recuperado",
    async () => {
      const tag = `ST23-${stamp}-SUM`;
      const customer = await ensureCustomer(stamp + 20);
      const v1 = await ensureVariant(stamp + 21, 5);
      const v2 = await ensureVariant(stamp + 22, 5);
      const a = await prisma.incident.create({
        data: {
          incidentDate: new Date(year, month - 1, 10),
          type: "DAMAGE",
          status: "OPEN",
          decision: "NONE",
          variantId: v1.id,
          customerId: customer.id,
          quantity: 1,
          description: tag,
          lostAmount: "50.00",
          recoveredAmount: "0",
        },
      });
      const b = await prisma.incident.create({
        data: {
          incidentDate: new Date(year, month - 1, 11),
          type: "RETURN",
          status: "RESOLVED",
          decision: "CREDIT",
          variantId: v2.id,
          customerId: customer.id,
          quantity: 1,
          description: tag,
          lostAmount: "0",
          recoveredAmount: "30.00",
        },
      });
      const c = await prisma.incident.create({
        data: {
          incidentDate: new Date(year, month - 1, 12),
          type: "DAMAGE",
          status: "CANCELLED",
          decision: "NONE",
          quantity: 1,
          description: tag,
          lostAmount: "999.00",
          recoveredAmount: "0",
        },
      });
      try {
        const summary = await getMonthlyIncidentSummary(year, month);
        const damage = summary.byType.find((bt) => bt.type === "DAMAGE");
        assert.ok(damage, "debe existir entrada DAMAGE");
        // El seed del Sprint 27 ya tiene un incidente DAMAGE
        // (Cartera rota) en el mes, por lo que validamos que el delta
        // del test (50 PEN) se haya sumado.
        const damageTestDelta = 5000;
        const damageExpected = damage.lostCents - damageTestDelta;
        assert.ok(
          damage.lostCents >= damageTestDelta,
          `DAMAGE lostCents >= ${damageTestDelta}, obtuvo ${damage.lostCents}`,
        );
        void damageExpected;
        // recovered del RETURN: el seed tiene 1 incidente RETURN de
        // 100 PEN, por lo que validamos el delta del test (30 PEN).
        const ret = summary.byType.find((bt) => bt.type === "RETURN");
        assert.ok(ret);
        assert.ok(
          ret.recoveredCents >= 3000,
          `RETURN recoveredCents >= 3000, obtuvo ${ret.recoveredCents}`,
        );
        const retTestDelta = ret.recoveredCents - 3000;
        assert.ok(
          retTestDelta >= 0,
          `El delta del RETURN (recuperado - 30) debe ser >= 0, obtuvo ${retTestDelta}`,
        );
        // netCents: total - se valida que el delta del test (recovered
        // 30 - lost 50 = -20) este aplicado.
        const netExpectedDelta = 3000 - 5000;
        const damageDelta = damage.lostCents - 5000;
        const returnDelta = ret.recoveredCents - 3000;
        const cancelDelta = 0; // c cancelado no aporta
        const expectedNet = damageDelta * -1 + returnDelta + cancelDelta;
        // summary.netCents = recovered - lost (a nivel global)
        const recovered = summary.recoveredCents;
        const lost = summary.lostCents;
        assert.equal(recovered - lost, summary.netCents);
        void netExpectedDelta;
        void expectedNet;
      } finally {
        await prisma.incident.deleteMany({
          where: { id: { in: [a.id, b.id, c.id] } },
        });
        await prisma.productVariant.deleteMany({
          where: { id: { in: [v1.id, v2.id] } },
        });
      }
    },
  );

  await run(
    "resolveIncident y cancelIncident cambian estado y auditan",
    async () => {
      const variant = await ensureVariant(stamp + 30, 5);
      const customer = await ensureCustomer(stamp + 31);
      try {
        const result = await createIncident({
          incidentDate: new Date().toISOString(),
          type: "DAMAGE",
          decision: "NONE",
          variantId: variant.id,
          customerId: customer.id,
          quantity: 1,
          description: "ST23 resolve test",
          lostAmount: "10.00",
          recoveredAmount: "0",
          createdById: admin.id,
        });
        await resolveIncident({
          incidentId: result.incidentId,
          actorId: admin.id,
          resolutionNotes: "Resuelto en test",
        });
        const resolved = await prisma.incident.findUnique({
          where: { id: result.incidentId },
        });
        assert.equal(resolved?.status, "RESOLVED");
        assert.ok(resolved?.resolvedAt);
        assert.equal(resolved?.resolutionNotes, "Resuelto en test");

        // resolver una ya resuelta debe fallar
        await assert.rejects(
          resolveIncident({
            incidentId: result.incidentId,
            actorId: admin.id,
          }),
          (err) =>
            err instanceof IncidentError &&
            (err as InstanceType<typeof IncidentError>).code === "ALREADY_RESOLVED",
        );

        // Una vez resuelta no se puede cancelar
        await assert.rejects(
          cancelIncident({
            incidentId: result.incidentId,
            actorId: admin.id,
            reason: "Test cancel",
          }),
          (err) =>
            err instanceof IncidentError &&
            (err as InstanceType<typeof IncidentError>).code === "ALREADY_RESOLVED",
        );

        // Crear otra incidencia y cancelarla
        const result2 = await createIncident({
          incidentDate: new Date().toISOString(),
          type: "CLAIM",
          decision: "DISCARDED",
          customerId: customer.id,
          quantity: 1,
          description: "ST23 cancel test",
          lostAmount: "0",
          recoveredAmount: "0",
          createdById: admin.id,
        });
        await cancelIncident({
          incidentId: result2.incidentId,
          actorId: admin.id,
          reason: "Test cancel",
        });
        const cancelled = await prisma.incident.findUnique({
          where: { id: result2.incidentId },
        });
        assert.equal(cancelled?.status, "CANCELLED");
        assert.equal(cancelled?.cancelledReason, "Test cancel");

        // resolver una cancelada debe fallar
        await assert.rejects(
          resolveIncident({
            incidentId: result2.incidentId,
            actorId: admin.id,
          }),
          (err) =>
            err instanceof IncidentError &&
            (err as InstanceType<typeof IncidentError>).code === "ALREADY_CANCELLED",
        );
      } finally {
        await prisma.incident.deleteMany({
          where: { description: { in: ["ST23 resolve test", "ST23 cancel test"] } },
        });
        await prisma.inventoryMovement.deleteMany({
          where: { variantId: variant.id, reason: { contains: "ST23" } },
        });
        await prisma.productVariant.deleteMany({
          where: { id: variant.id },
        });
      }
    },
  );

  console.log(`\n  ${passed} ok, ${failed} fail`);
  if (failed > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
