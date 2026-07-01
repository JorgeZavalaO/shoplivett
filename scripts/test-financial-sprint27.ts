// Tests de dominio Sprint 27 - seed financiero + cobertura de los 7
// escenarios obligatorios del plan financiero por lotes.
//
// Asume que `pnpm db:seed` ya sembró los datos con prefijo FIN27 (4
// lotes, 12 productos/variantes, 3 clientas, 5 ventas PAID, 5 gastos,
// 2 incidencias). Los tests son de solo lectura: verifican los
// snapshots de costo y la trazabilidad de las integraciones ya
// ejercitadas en los sprints anteriores (costeo, FIFO, utilidad
// mensual por PAID, gastos mensuales).
//
// Cubre:
//   1. Lote rentable LOTE-FIN-2025-001-OLD con margen > 30% en
//      ventas asignadas a la capa antigua.
//   2. Margen bajo LOTE-FIN-2025-002 con margen < 15% tras reconocer
//      utilidad.
//   3. Descuento en FIN27-0002 con discount=30 y linea de utilidad
//      bruta coherente.
//   4. Delivery asumido en FIN27-0002 con shippingAmount=12 sumado
//      al netLineRevenue y al total del pedido.
//   5. Lote parcial LOTE-FIN-2025-003 en COMPLETE con
//      quantityAvailable > 0.
//   6. Lote cerrado LOTE-FIN-2025-004 en CLOSED sin ventas asignadas
//      en el seed.
//   7. Producto dañado: incidente DAMAGE FIN27 Cartera rota reduce
//      stock y registra movimiento ADJUSTMENT.

import assert from "node:assert/strict";

import { prisma } from "../lib/prisma";

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

async function main() {
  console.log("Sprint 27 - test-financial-sprint27");

  await run(
    "RF-S27-01 + Escenario 1: Lote rentable LOTE-FIN-2025-001-OLD asigna stock a FIN27-0001 y la utilidad por item PAID supera 50%",
    async () => {
      const rentableBatch = await prisma.importBatch.findUnique({
        where: { code: "LOTE-FIN-2025-001-OLD" },
        include: { items: true },
      });
      assert.ok(rentableBatch, "LOTE-FIN-2025-001-OLD debe existir");
      assert.equal(rentableBatch!.status, "COMPLETE");
      assert.ok(
        rentableBatch!.items.length >= 2,
        "El lote rentable debe tener al menos 2 items",
      );

      const rentableOrder = await prisma.order.findUnique({
        where: { orderNumber: "FIN27-0001" },
        include: {
          items: { include: { allocations: true } },
        },
      });
      assert.ok(rentableOrder, "FIN27-0001 debe existir");
      assert.equal(rentableOrder!.status, "PAID");
      assert.ok(rentableOrder!.profitCalculatedAt, "profitCalculatedAt poblado");
      assert.equal(rentableOrder!.items.length, 1);
      const item = rentableOrder!.items[0]!;
      assert.equal(item.costSource, "BATCH");
      const allocatedQty = item.allocations.reduce(
        (acc, a) => acc + a.quantity,
        0,
      );
      assert.equal(allocatedQty, item.quantity);

      const revenueCents = Math.round(Number(item.lineTotal) * 100);
      const costCents = item.allocations.reduce(
        (acc, a) => acc + Math.round(Number(a.subtotalCostPen) * 100),
        0,
      );
      const marginBps =
        revenueCents > 0
          ? Math.round(((revenueCents - costCents) * 10000) / revenueCents)
          : 0;
      assert.ok(
        marginBps > 5000,
        `margen esperado > 50%, obtuvo ${marginBps / 100}%`,
      );
      void revenueCents;
    },
  );

  await run(
    "RF-S27-02 + Escenario 2: Lote con margen bajo LOTE-FIN-2025-002 mantiene margen < 15% en la venta asignada",
    async () => {
      const lowMarginBatch = await prisma.importBatch.findUnique({
        where: { code: "LOTE-FIN-2025-002" },
        include: { items: true },
      });
      assert.ok(lowMarginBatch, "LOTE-FIN-2025-002 debe existir");
      assert.ok(lowMarginBatch!.items.length >= 4);

      const lowMarginOrder = await prisma.order.findUnique({
        where: { orderNumber: "FIN27-0004" },
        include: { items: { include: { allocations: true } } },
      });
      assert.ok(lowMarginOrder, "FIN27-0004 debe existir");
      assert.equal(lowMarginOrder!.status, "PAID");
      const item = lowMarginOrder!.items[0]!;
      const revenueCents = Math.round(Number(item.lineTotal) * 100);
      const costCents = item.allocations.reduce(
        (acc, a) => acc + Math.round(Number(a.subtotalCostPen) * 100),
        0,
      );
      const marginBps =
        revenueCents > 0
          ? Math.round(((revenueCents - costCents) * 10000) / revenueCents)
          : 0;
      assert.ok(
        marginBps < 1500,
        `margen esperado < 15%, obtuvo ${marginBps / 100}%`,
      );
      assert.ok(costCents > 0, "Costo real debe estar poblado");
      void revenueCents;
    },
  );

  await run(
    "RF-S27-03 + Escenario 3: Pedido con descuento (FIN27-0002) reconoce lineDiscountPen y grossProfit coherente",
    async () => {
      const discountOrder = await prisma.order.findUnique({
        where: { orderNumber: "FIN27-0002" },
        include: { items: true },
      });
      assert.ok(discountOrder, "FIN27-0002 debe existir");
      assert.equal(Number(discountOrder!.discount), 30);
      const item = discountOrder!.items[0]!;
      assert.ok(
        Number(item.lineDiscountPen) > 0,
        "El descuento debe quedar registrado en el item",
      );
      const subtotalCents = Math.round(
        Number(item.unitPrice) * item.quantity * 100,
      );
      const discountCents = Math.round(Number(item.lineDiscountPen) * 100);
      assert.ok(discountCents > 0 && discountCents < subtotalCents);
      const shippingCents = Math.round(Number(discountOrder!.shippingAmount) * 100);
      const netRevenueCents = Math.round(Number(item.netLineRevenuePen) * 100);
      const expectedNet =
        subtotalCents - discountCents + shippingCents;
      assert.ok(
        Math.abs(netRevenueCents - expectedNet) < 1,
        `netRevenueCents=${netRevenueCents} expectedNet=${expectedNet} (diff ${Math.abs(netRevenueCents - expectedNet)})`,
      );
      const itemCostCents = Math.round(Number(item.totalCostPen) * 100);
      const itemGrossCents = Math.round(Number(item.grossProfitPen) * 100);
      assert.ok(
        Math.abs(itemGrossCents - (netRevenueCents - itemCostCents)) < 1,
        `itemGrossCents=${itemGrossCents} expected=${netRevenueCents - itemCostCents}`,
      );
    },
  );

  await run(
    "RF-S27-04 + Escenario 4: Delivery asumido (FIN27-0002) suma shippingAmount al total del pedido y a la linea",
    async () => {
      const deliveryOrder = await prisma.order.findUnique({
        where: { orderNumber: "FIN27-0002" },
        include: { items: true },
      });
      assert.ok(deliveryOrder, "FIN27-0002 debe existir");
      assert.ok(
        Number(deliveryOrder!.shippingAmount) > 0,
        "El shippingAmount debe ser positivo",
      );
      const expectedTotalCents = Math.round(
        (Number(deliveryOrder!.subtotal) -
          Number(deliveryOrder!.discount) +
          Number(deliveryOrder!.shippingAmount)) *
          100,
      );
      const totalCents = Math.round(Number(deliveryOrder!.total) * 100);
      assert.ok(
        Math.abs(totalCents - expectedTotalCents) < 1,
        `totalCents=${totalCents} expectedTotalCents=${expectedTotalCents}`,
      );

      // La linea de pedido debe llevar el envio prorrateado en el
      // netLineRevenuePen para que la suma de lineas cierre con el
      // total del pedido (cuando hay un solo item, el envio va
      // integro a esa linea).
      const lineSumCents = deliveryOrder!.items.reduce(
        (acc, it) => acc + Math.round(Number(it.netLineRevenuePen) * 100),
        0,
      );
      const shippingCents = Math.round(
        Number(deliveryOrder!.shippingAmount) * 100,
      );
      assert.ok(
        Math.abs(lineSumCents - expectedTotalCents) < 1,
        `lineSumCents=${lineSumCents} expectedTotalCents=${expectedTotalCents}`,
      );
      const firstItem = deliveryOrder!.items[0]!;
      const firstItemSubtotalCents = Math.round(
        Number(firstItem.unitPrice) * firstItem.quantity * 100,
      );
      const firstItemDiscountCents = Math.round(
        Number(deliveryOrder!.discount) * 100,
      );
      assert.ok(
        lineSumCents - firstItemSubtotalCents >=
          shippingCents - firstItemDiscountCents,
        "La linea de pedido debe reflejar el envio asumido",
      );
    },
  );

  await run(
    "RF-S27-05 + Escenario 5: Lote parcial LOTE-FIN-2025-003 sigue COMPLETE con quantityAvailable > 0",
    async () => {
      const partialBatch = await prisma.importBatch.findUnique({
        where: { code: "LOTE-FIN-2025-003" },
        include: { items: true },
      });
      assert.ok(partialBatch, "LOTE-FIN-2025-003 debe existir");
      assert.equal(partialBatch!.status, "COMPLETE");
      const totalAvailable = partialBatch!.items.reduce(
        (acc, it) => acc + it.quantityAvailable,
        0,
      );
      assert.ok(
        totalAvailable > 0,
        `quantityAvailable total debe ser > 0, obtuvo ${totalAvailable}`,
      );
      const totalReceived = partialBatch!.items.reduce(
        (acc, it) => acc + it.quantityReceived,
        0,
      );
      assert.ok(
        totalReceived > totalAvailable,
        `quantityReceived (${totalReceived}) debe ser mayor que quantityAvailable (${totalAvailable})`,
      );
    },
  );

  await run(
    "RF-S27-06 + Escenario 6: Lote cerrado LOTE-FIN-2025-004 queda CLOSED sin ventas asignadas en el seed",
    async () => {
      const closedBatch = await prisma.importBatch.findUnique({
        where: { code: "LOTE-FIN-2025-004" },
        include: { items: { include: { allocations: true } } },
      });
      assert.ok(closedBatch, "LOTE-FIN-2025-004 debe existir");
      assert.equal(closedBatch!.status, "CLOSED");
      const allocs = closedBatch!.items.reduce(
        (acc, it) => acc + it.allocations.length,
        0,
      );
      assert.equal(allocs, 0, "El lote cerrado no debe tener allocations");
    },
  );

  await run(
    "RF-S27-07 + Escenario 7: Incidencia DAMAGE reduce stock de la variante y registra movimiento ADJUSTMENT",
    async () => {
      const incident = await prisma.incident.findFirst({
        where: {
          description: "FIN27 Cartera rota en exhibicion antes de salir a tienda",
        },
      });
      assert.ok(incident, "Incidencia DAMAGE debe existir");
      assert.equal(incident!.type, "DAMAGE");
      assert.equal(incident!.status, "RESOLVED");
      assert.ok(incident!.variantId, "Incidencia debe tener variante");

      const movement = await prisma.inventoryMovement.findFirst({
        where: {
          variantId: incident!.variantId,
          reason: { contains: incident!.id },
          type: "ADJUSTMENT",
        },
      });
      assert.ok(movement, "Debe existir un movimiento ADJUSTMENT");
      assert.ok(
        (movement!.quantity) < 0,
        "Movimiento debe ser negativo",
      );
      assert.equal(Math.abs(movement!.quantity), incident!.quantity);
    },
  );

  void prisma.$disconnect();
  console.log(`\nTotal: ${passed} ok / ${failed} fail`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
