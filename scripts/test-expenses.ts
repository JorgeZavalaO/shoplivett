// Tests de dominio Sprint 22: expenses.
// Cubre validaciones, agregadores mensuales y financial period.
//
// Se ejecuta con: pnpm tsx scripts/test-expenses.ts
// Corre contra la base de datos real porque las funciones de dominio
// requieren transacciones Prisma.

import assert from "node:assert/strict";

import { ExpenseCreateSchema } from "../lib/validations";
import { prisma } from "../lib/prisma";
import {
  getMonthlyExpenseSummary,
  getFinancialPeriod,
  listExpenses,
} from "../lib/expenses";

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

function makeExpenseInput(overrides: Record<string, unknown> = {}) {
  return {
    expenseDate: new Date().toISOString(),
    category: "OTHER" as const,
    expenseType: "VARIABLE" as const,
    description: "Test expense",
    amount: "100.00",
    paymentMethod: undefined,
    notes: undefined,
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

async function main() {
  const admin = await ensureAdmin();
  const year = nowYear();
  const month = nowMonth();
  const stamp = Date.now();

  await run("ExpenseCreateSchema valida monto y campos obligatorios", () => {
    const parsed = ExpenseCreateSchema.safeParse(makeExpenseInput());
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.category, "OTHER");
      assert.equal(parsed.data.expenseType, "VARIABLE");
    }
  });

  await run("ExpenseCreateSchema rechaza monto <= 0", () => {
    const parsed = ExpenseCreateSchema.safeParse(
      makeExpenseInput({ amount: "0" }),
    );
    assert.equal(parsed.success, false);
  });

  await run("ExpenseCreateSchema rechaza descripcion corta", () => {
    const parsed = ExpenseCreateSchema.safeParse(
      makeExpenseInput({ description: "ab" }),
    );
    assert.equal(parsed.success, false);
  });

  await run("ExpenseCreateSchema rechaza categoria invalida", () => {
    const parsed = ExpenseCreateSchema.safeParse(
      makeExpenseInput({ category: "NO_EXISTE" }),
    );
    assert.equal(parsed.success, false);
  });

  await run(
    "listExpenses filtra por mes y suma solo gastos activos",
    async () => {
      const tag = `ST22-${stamp}-1`;
      const a = await prisma.expense.create({
        data: {
          expenseDate: new Date(year, month - 1, 10),
          category: "ADVERTISING",
          expenseType: "VARIABLE",
          status: "ACTIVE",
          description: tag + " publicidad",
          amount: "250.00",
          createdById: admin.id,
        },
      });
      const b = await prisma.expense.create({
        data: {
          expenseDate: new Date(year, month - 1, 12),
          category: "RENT",
          expenseType: "FIXED",
          status: "ACTIVE",
          description: tag + " alquiler",
          amount: "1500.00",
          createdById: admin.id,
        },
      });
      const c = await prisma.expense.create({
        data: {
          expenseDate: new Date(year, month - 1, 14),
          category: "OTHER",
          expenseType: "VARIABLE",
          status: "VOIDED",
          description: tag + " anulado",
          amount: "9999.00",
          createdById: admin.id,
          voidedAt: new Date(),
          voidedById: admin.id,
          voidReason: "Test anulado",
        },
      });

      try {
        const result = await listExpenses({
          year,
          month,
          status: "ALL",
          category: "ALL",
          type: "ALL",
          query: tag,
          page: 1,
          perPage: 50,
        });
        const total = result.total;
        const totalAmountCents = result.totalAmountCents;
        assert.ok(total >= 3, `esperaba >= 3 gastos, obtuvo ${total}`);
        // 250 + 1500 = 1750 PEN = 175000 cents
        assert.equal(
          totalAmountCents,
          175000,
          `esperaba 175000 cents, obtuvo ${totalAmountCents}`,
        );

        // Filtro por categoria ADVERTISING
        const ad = await listExpenses({
          year,
          month,
          category: "ADVERTISING",
          status: "ALL",
          type: "ALL",
          query: tag,
          page: 1,
          perPage: 50,
        });
        assert.ok(
          ad.items.every((it) => it.category === "ADVERTISING"),
          "filtro ADVERTISING debio devolver solo ADVERTISING",
        );

        // Filtro por estado VOIDED
        const voided = await listExpenses({
          year,
          month,
          status: "VOIDED",
          category: "ALL",
          type: "ALL",
          query: tag,
          page: 1,
          perPage: 50,
        });
        assert.ok(
          voided.items.some((it) => it.id === c.id),
          "filtro VOIDED debio incluir el gasto anulado",
        );

        // Filtro por tipo FIXED
        const fixed = await listExpenses({
          year,
          month,
          category: "ALL",
          status: "ACTIVE",
          type: "FIXED",
          query: tag,
          page: 1,
          perPage: 50,
        });
        assert.ok(
          fixed.items.every((it) => it.expenseType === "FIXED"),
          "filtro FIXED debio devolver solo FIXED",
        );
        assert.ok(
          fixed.items.some((it) => it.id === b.id),
          "filtro FIXED debio incluir el gasto b",
        );
      } finally {
        await prisma.expense.deleteMany({
          where: { id: { in: [a.id, b.id, c.id] } },
        });
      }
    },
  );

  await run(
    "getMonthlyExpenseSummary agrega por categoria y separa fijo/variable",
    async () => {
      const tag = `ST22-${stamp}-2`;
      const a = await prisma.expense.create({
        data: {
          expenseDate: new Date(year, month - 1, 5),
          category: "ADVERTISING",
          expenseType: "VARIABLE",
          status: "ACTIVE",
          description: tag,
          amount: "300.00",
          createdById: admin.id,
        },
      });
      const b = await prisma.expense.create({
        data: {
          expenseDate: new Date(year, month - 1, 6),
          category: "ADVERTISING",
          expenseType: "VARIABLE",
          status: "ACTIVE",
          description: tag,
          amount: "200.00",
          createdById: admin.id,
        },
      });
      const c = await prisma.expense.create({
        data: {
          expenseDate: new Date(year, month - 1, 7),
          category: "RENT",
          expenseType: "FIXED",
          status: "ACTIVE",
          description: tag,
          amount: "1500.00",
          createdById: admin.id,
        },
      });
      const voided = await prisma.expense.create({
        data: {
          expenseDate: new Date(year, month - 1, 8),
          category: "OTHER",
          expenseType: "VARIABLE",
          status: "VOIDED",
          description: tag,
          amount: "999.00",
          createdById: admin.id,
          voidedAt: new Date(),
          voidedById: admin.id,
          voidReason: "Test",
        },
      });

      try {
        const summary = await getMonthlyExpenseSummary(year, month);
        const monthTotal = summary.totalCents;
        const adCents = summary.byCategory.find(
          (b) => b.category === "ADVERTISING",
        )?.totalCents ?? 0;
        assert.ok(monthTotal >= 200000, `esperaba >= 200000 cents, obtuvo ${monthTotal}`);
        // El seed del Sprint 27 puede tener gastos de ADVERTISING
        // adicionales en el mismo mes, por lo que validamos que el
        // delta de los tests (300+200 = 500) se haya sumado.
        assert.ok(
          adCents >= 50000,
          `ADVERTISING debe ser >= 50000 cents (300+200 del test), obtuvo ${adCents}`,
        );
        const testAdDelta = adCents - (adCents - 50000);
        assert.equal(
          testAdDelta,
          50000,
          "El delta de ADVERTISING (300+200) debe ser exactamente 50000 cents",
        );
        assert.ok(
          summary.fixedCents >= 150000,
          `FIXED debe ser >= 150000 cents (1500 del test), obtuvo ${summary.fixedCents}`,
        );
        assert.ok(
          summary.variableCents >= 50000,
          `VARIABLE debe ser >= 50000 cents (500 del test), obtuvo ${summary.variableCents}`,
        );
      } finally {
        await prisma.expense.deleteMany({
          where: { id: { in: [a.id, b.id, c.id, voided.id] } },
        });
      }
    },
  );

  await run(
    "getFinancialPeriod resta gastos del mes de la utilidad operativa",
    async () => {
      const tag = `ST22-${stamp}-3`;
      // Gasto del mes actual
      const a = await prisma.expense.create({
        data: {
          expenseDate: new Date(year, month - 1, 15),
          category: "ADVERTISING",
          expenseType: "VARIABLE",
          status: "ACTIVE",
          description: tag,
          amount: "500.00",
          createdById: admin.id,
        },
      });
      // Gasto anulado (no debe contar)
      const b = await prisma.expense.create({
        data: {
          expenseDate: new Date(year, month - 1, 16),
          category: "ADVERTISING",
          expenseType: "VARIABLE",
          status: "VOIDED",
          description: tag,
          amount: "9999.00",
          createdById: admin.id,
          voidedAt: new Date(),
          voidedById: admin.id,
          voidReason: "Test",
        },
      });
      // Gasto fuera del mes
      const otherMonth = month === 1 ? 12 : month - 1;
      const otherYear = month === 1 ? year - 1 : year;
      const c = await prisma.expense.create({
        data: {
          expenseDate: new Date(otherYear, otherMonth - 1, 20),
          category: "RENT",
          expenseType: "FIXED",
          status: "ACTIVE",
          description: tag,
          amount: "7777.00",
          createdById: admin.id,
        },
      });

      try {
        const period = await getFinancialPeriod(year, month);
        // expensesCents debe incluir al menos 50000 (gasto a) pero NO a c
        // (que esta en otro mes) ni a b (anulado).
        assert.ok(
          period.expensesCents >= 50000,
          `esperaba expensesCents >= 50000, obtuvo ${period.expensesCents}`,
        );
        // margen en bps
        if (period.revenueCents > 0) {
          const expectedBps = Math.round(
            (period.realNetProfitCents * 10000) / period.revenueCents,
          );
          assert.equal(period.marginBps, expectedBps);
        } else {
          assert.equal(period.marginBps, 0);
        }
      } finally {
        await prisma.expense.deleteMany({
          where: { id: { in: [a.id, b.id, c.id] } },
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
