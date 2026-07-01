import "dotenv/config";

import bcrypt from "bcryptjs";
import {
  type CostAllocationMethod,
  type ExpenseCategory,
  type ExpenseType,
  type IncidentReturnDecision,
  type IncidentStatus,
  type IncidentType,
  type PaymentMethod,
  type SalesChannel,
} from "@prisma/client";

import { DEFAULT_BUSINESS_SETTINGS } from "../lib/settings-defaults";
import { prisma } from "../lib/prisma";

type SeedUser = {
  role: "ADMIN" | "SELLER" | "DISPATCH";
  email: string;
  name: string;
  password: string;
};

const FALLBACK = "change-me-in-env";

function readUser(
  envEmail: string | undefined,
  envPassword: string | undefined,
  envName: string | undefined,
  role: "ADMIN" | "SELLER" | "DISPATCH",
  defaults: { email: string; name: string },
): SeedUser {
  return {
    role,
    email: envEmail || defaults.email,
    name: envName || defaults.name,
    password: envPassword || FALLBACK,
  };
}

type SeedCategory = { name: string; slug: string };
const SEED_CATEGORIES: SeedCategory[] = [
  { name: "Carteras de mano", slug: "cartera-de-mano" },
  { name: "Mochilas", slug: "mochilas" },
  { name: "Accesorios", slug: "accesorios" },
  { name: "Billeteras", slug: "billeteras" },
  { name: "Riñoneras", slug: "rinoneras" },
];

type BatchPlanRentable = {
  kind: "rentable";
  batchCode: string;
  oldDate: Date;
  newDate: Date;
  oldUnitCostUsd: string;
  oldQuantity: number;
  newUnitCostUsd: string;
  newQuantity: number;
  shopper: string;
  agency: string;
  exchangeRate: string;
  totalAdditionalCostsUsd: string;
};
type BatchPlanLowMargin = {
  kind: "low-margin";
  batchCode: string;
  date: Date;
  unitCostUsd: string;
  quantity: number;
  shopper: string;
  agency: string;
  exchangeRate: string;
  totalAdditionalCostsUsd: string;
};
type BatchPlanPartialClosed = {
  kind: "partial-closed";
  batchCode: string;
  status: "PURCHASED" | "IN_TRANSIT" | "COMPLETE" | "CLOSED";
  date: Date;
  unitCostUsd: string;
  quantity: number;
  shopper: string;
  agency: string;
  exchangeRate: string;
  totalAdditionalCostsUsd: string;
};
type BatchPlan = BatchPlanRentable | BatchPlanLowMargin | BatchPlanPartialClosed;

type SeedProduct = {
  code: string;
  name: string;
  categorySlug: string;
  color: string;
  material: string;
  size: string;
  price: string;
  stock: number;
  batch: BatchPlan | null;
};

const SEED_PRODUCTS: SeedProduct[] = [
  {
    code: "FIN-CART-001-NEG",
    name: "Cartera de mano Niza",
    categorySlug: "cartera-de-mano",
    color: "Negro",
    material: "Cuero",
    size: "M",
    price: "180.00",
    stock: 8,
    batch: {
      kind: "rentable",
      batchCode: "LOTE-FIN-2025-001",
      oldDate: new Date("2025-09-01T00:00:00Z"),
      newDate: new Date("2025-09-15T00:00:00Z"),
      oldUnitCostUsd: "20.0000",
      oldQuantity: 5,
      newUnitCostUsd: "22.0000",
      newQuantity: 5,
      shopper: "Maria Compras",
      agency: "Miami Imports",
      exchangeRate: "3.7500",
      totalAdditionalCostsUsd: "30.00",
    },
  },
  {
    code: "FIN-CART-002-BOR",
    name: "Cartera de mano Borgona",
    categorySlug: "cartera-de-mano",
    color: "Borgoña",
    material: "Cuero",
    size: "M",
    price: "190.00",
    stock: 6,
    batch: {
      kind: "low-margin",
      batchCode: "LOTE-FIN-2025-002",
      date: new Date("2025-09-20T00:00:00Z"),
      unitCostUsd: "46.0000",
      quantity: 6,
      shopper: "Carlos Compras",
      agency: "Bogota Trading",
      exchangeRate: "3.7500",
      totalAdditionalCostsUsd: "20.00",
    },
  },
  {
    code: "FIN-MOCH-001-VER",
    name: "Mochila Verona",
    categorySlug: "mochilas",
    color: "Verde",
    material: "Lona",
    size: "L",
    price: "240.00",
    stock: 5,
    batch: {
      kind: "rentable",
      batchCode: "LOTE-FIN-2025-001",
      oldDate: new Date("2025-09-01T00:00:00Z"),
      newDate: new Date("2025-09-15T00:00:00Z"),
      oldUnitCostUsd: "32.0000",
      oldQuantity: 3,
      newUnitCostUsd: "30.0000",
      newQuantity: 3,
      shopper: "Maria Compras",
      agency: "Miami Imports",
      exchangeRate: "3.7500",
      totalAdditionalCostsUsd: "30.00",
    },
  },
  {
    code: "FIN-MOCH-002-AZU",
    name: "Mochila Azules",
    categorySlug: "mochilas",
    color: "Azul",
    material: "Lona",
    size: "L",
    price: "220.00",
    stock: 4,
    batch: {
      kind: "low-margin",
      batchCode: "LOTE-FIN-2025-002",
      date: new Date("2025-09-20T00:00:00Z"),
      unitCostUsd: "55.0000",
      quantity: 4,
      shopper: "Carlos Compras",
      agency: "Bogota Trading",
      exchangeRate: "3.7500",
      totalAdditionalCostsUsd: "20.00",
    },
  },
  {
    code: "FIN-ACC-001-ROS",
    name: "Bandolera Rosa",
    categorySlug: "accesorios",
    color: "Rosa",
    material: "Sintético",
    size: "S",
    price: "90.00",
    stock: 10,
    batch: {
      kind: "partial-closed",
      status: "COMPLETE",
      batchCode: "LOTE-FIN-2025-003",
      date: new Date("2025-08-10T00:00:00Z"),
      unitCostUsd: "12.0000",
      quantity: 4,
      shopper: "Maria Compras",
      agency: "Asuncion Trading",
      exchangeRate: "3.7500",
      totalAdditionalCostsUsd: "10.00",
    },
  },
  {
    code: "FIN-ACC-002-NEG",
    name: "Cinturon Negro",
    categorySlug: "accesorios",
    color: "Negro",
    material: "Cuero",
    size: "M",
    price: "75.00",
    stock: 8,
    batch: {
      kind: "partial-closed",
      status: "COMPLETE",
      batchCode: "LOTE-FIN-2025-003",
      date: new Date("2025-08-10T00:00:00Z"),
      unitCostUsd: "10.0000",
      quantity: 4,
      shopper: "Maria Compras",
      agency: "Asuncion Trading",
      exchangeRate: "3.7500",
      totalAdditionalCostsUsd: "10.00",
    },
  },
  {
    code: "FIN-BIL-001-CAF",
    name: "Billetera Cafe",
    categorySlug: "billeteras",
    color: "Café",
    material: "Cuero",
    size: "S",
    price: "60.00",
    stock: 6,
    batch: {
      kind: "partial-closed",
      status: "COMPLETE",
      batchCode: "LOTE-FIN-2025-003",
      date: new Date("2025-08-10T00:00:00Z"),
      unitCostUsd: "8.0000",
      quantity: 6,
      shopper: "Maria Compras",
      agency: "Asuncion Trading",
      exchangeRate: "3.7500",
      totalAdditionalCostsUsd: "10.00",
    },
  },
  {
    code: "FIN-BIL-002-NEG",
    name: "Billetera Slim Negra",
    categorySlug: "billeteras",
    color: "Negro",
    material: "Cuero",
    size: "XS",
    price: "55.00",
    stock: 4,
    batch: {
      kind: "partial-closed",
      status: "CLOSED",
      batchCode: "LOTE-FIN-2025-004",
      date: new Date("2025-05-12T00:00:00Z"),
      unitCostUsd: "9.0000",
      quantity: 4,
      shopper: "Maria Compras",
      agency: "Asuncion Trading",
      exchangeRate: "3.7500",
      totalAdditionalCostsUsd: "5.00",
    },
  },
  {
    code: "FIN-RIN-001-GRI",
    name: "Riñonera Gris",
    categorySlug: "rinoneras",
    color: "Gris",
    material: "Nylon",
    size: "M",
    price: "110.00",
    stock: 5,
    batch: {
      kind: "low-margin",
      batchCode: "LOTE-FIN-2025-002",
      date: new Date("2025-09-20T00:00:00Z"),
      unitCostUsd: "26.0000",
      quantity: 5,
      shopper: "Carlos Compras",
      agency: "Bogota Trading",
      exchangeRate: "3.7500",
      totalAdditionalCostsUsd: "20.00",
    },
  },
  {
    code: "FIN-RIN-002-NEG",
    name: "Riñonera Urbana Negra",
    categorySlug: "rinoneras",
    color: "Negro",
    material: "Nylon",
    size: "M",
    price: "120.00",
    stock: 4,
    batch: {
      kind: "low-margin",
      batchCode: "LOTE-FIN-2025-002",
      date: new Date("2025-09-20T00:00:00Z"),
      unitCostUsd: "28.0000",
      quantity: 4,
      shopper: "Carlos Compras",
      agency: "Bogota Trading",
      exchangeRate: "3.7500",
      totalAdditionalCostsUsd: "20.00",
    },
  },
  {
    code: "FIN-CART-003-CAS",
    name: "Cartera Casual Beige",
    categorySlug: "cartera-de-mano",
    color: "Beige",
    material: "Lona",
    size: "M",
    price: "150.00",
    stock: 3,
    batch: {
      kind: "partial-closed",
      status: "CLOSED",
      batchCode: "LOTE-FIN-2025-004",
      date: new Date("2025-05-12T00:00:00Z"),
      unitCostUsd: "22.0000",
      quantity: 3,
      shopper: "Maria Compras",
      agency: "Asuncion Trading",
      exchangeRate: "3.7500",
      totalAdditionalCostsUsd: "5.00",
    },
  },
];

type SeedCustomer = { name: string; whatsapp: string; status: "ACTIVE" | "FREQUENT" | "RISKY"; address: string; district: string };
const SEED_CUSTOMERS: SeedCustomer[] = [
  {
    name: "Lucia Castaño",
    whatsapp: "+51915000001",
    status: "FREQUENT",
    address: "Av. La Marina 123",
    district: "San Miguel",
  },
  {
    name: "Maria Fernanda Quispe",
    whatsapp: "+51916000002",
    status: "ACTIVE",
    address: "Jr. Las Flores 456",
    district: "Miraflores",
  },
  {
    name: "Patricia Soto",
    whatsapp: "+51917000003",
    status: "ACTIVE",
    address: "Calle Los Pinos 789",
    district: "Surco",
  },
];

const SETTINGS_OVERRIDE: Partial<typeof DEFAULT_BUSINESS_SETTINGS> = {
  minimumTargetMarginBps: 1500,
  objectiveTargetMarginBps: 3000,
  defaultCostAllocationMethod: "MIXED" as CostAllocationMethod,
  mixedValueAllocationPercent: 50,
  mixedWeightAllocationPercent: 50,
  standardPackagingCostPen: "2.00",
  paymentMethodFees: {
    YAPE: 0,
    PLIN: 0,
    CASH: 0,
    OTHER: 0,
  },
  enabledSalesChannels: [
    "TIKTOK_LIVE",
    "INSTAGRAM_LIVE",
    "TIENDA",
    "WHATSAPP_DIRECTO",
  ] as SalesChannel[],
};

type SeedExpense = {
  description: string;
  amount: string;
  category: ExpenseCategory;
  expenseType: ExpenseType;
  expenseDate: Date;
  paymentMethod: string | null;
  notes: string | null;
};

const SEED_EXPENSES: SeedExpense[] = [
  {
    description: "Campaña TikTok Live",
    amount: "450.00",
    category: "ADVERTISING",
    expenseType: "VARIABLE",
    expenseDate: new Date(new Date().getFullYear(), new Date().getMonth(), 3, 12, 0, 0, 0),
    paymentMethod: "YAPE",
    notes: "Pauta live del 1 al 7",
  },
  {
    description: "Alquiler del local",
    amount: "1800.00",
    category: "RENT",
    expenseType: "FIXED",
    expenseDate: new Date(new Date().getFullYear(), new Date().getMonth(), 8, 12, 0, 0, 0),
    paymentMethod: "TRANSFER",
    notes: null,
  },
  {
    description: "Internet y telefonia",
    amount: "189.90",
    category: "INTERNET",
    expenseType: "FIXED",
    expenseDate: new Date(new Date().getFullYear(), new Date().getMonth(), 12, 12, 0, 0, 0),
    paymentMethod: "AUTO",
    notes: null,
  },
  {
    description: "Empaque y bolsas",
    amount: "240.00",
    category: "PACKAGING",
    expenseType: "VARIABLE",
    expenseDate: new Date(new Date().getFullYear(), new Date().getMonth(), 18, 12, 0, 0, 0),
    paymentMethod: "CASH",
    notes: null,
  },
  {
    description: "Comision delivery Olva",
    amount: "120.00",
    category: "SHIPPING",
    expenseType: "VARIABLE",
    expenseDate: new Date(new Date().getFullYear(), new Date().getMonth(), 22, 12, 0, 0, 0),
    paymentMethod: "CASH",
    notes: null,
  },
];

type SeedIncident = {
  type: IncidentType;
  decision: IncidentReturnDecision;
  status: IncidentStatus;
  description: string;
  quantity: number;
  restockQuantity: number;
  lostAmount: string;
  recoveredAmount: string;
  productCode: string | null;
  customerIndex: number | null;
  daysAgo: number;
};

const SEED_INCIDENTS: SeedIncident[] = [
  {
    type: "DAMAGE",
    decision: "NONE",
    status: "RESOLVED",
    description: "Cartera rota en exhibicion antes de salir a tienda",
    quantity: 1,
    restockQuantity: 0,
    lostAmount: "180.00",
    recoveredAmount: "0",
    productCode: "FIN-CART-002-BOR",
    customerIndex: null,
    daysAgo: 4,
  },
  {
    type: "RETURN",
    decision: "CREDIT",
    status: "RESOLVED",
    description: "Cliente devolvio la mochila por descuadre en costura",
    quantity: 1,
    restockQuantity: 0,
    lostAmount: "0",
    recoveredAmount: "100.00",
    productCode: "FIN-MOCH-002-AZU",
    customerIndex: 1,
    daysAgo: 2,
  },
];

const SEED_LIVE = {
  name: "Live TikTok Martes Dorado",
  channel: "TIKTOK" as const,
  status: "CLOSED" as const,
  startedDaysAgo: 6,
  durationHours: 2,
};

type SeedSale = {
  customerIndex: number;
  productCode: string;
  quantity: number;
  unitPrice: string;
  discount: string;
  shippingAmount: string;
  advanceAmount: string;
  totalAmount: string;
  paymentMethod: PaymentMethod;
  salesChannel: SalesChannel;
  status: "PAID" | "PARTIALLY_PAID";
  daysAgo: number;
};
const SEED_SALES: SeedSale[] = [
  {
    customerIndex: 0,
    productCode: "FIN-CART-001-NEG",
    quantity: 1,
    unitPrice: "180.00",
    discount: "0",
    shippingAmount: "0",
    advanceAmount: "180.00",
    totalAmount: "180.00",
    paymentMethod: "YAPE",
    salesChannel: "TIKTOK_LIVE",
    status: "PAID",
    daysAgo: 5,
  },
  {
    customerIndex: 1,
    productCode: "FIN-MOCH-001-VER",
    quantity: 1,
    unitPrice: "240.00",
    discount: "30.00",
    shippingAmount: "12.00",
    advanceAmount: "222.00",
    totalAmount: "222.00",
    paymentMethod: "YAPE",
    salesChannel: "TIKTOK_LIVE",
    status: "PAID",
    daysAgo: 5,
  },
  {
    customerIndex: 1,
    productCode: "FIN-BIL-001-CAF",
    quantity: 2,
    unitPrice: "60.00",
    discount: "0",
    shippingAmount: "0",
    advanceAmount: "120.00",
    totalAmount: "120.00",
    paymentMethod: "PLIN",
    salesChannel: "INSTAGRAM_LIVE",
    status: "PAID",
    daysAgo: 4,
  },
  {
    customerIndex: 2,
    productCode: "FIN-CART-002-BOR",
    quantity: 1,
    unitPrice: "190.00",
    discount: "0",
    shippingAmount: "0",
    advanceAmount: "190.00",
    totalAmount: "190.00",
    paymentMethod: "YAPE",
    salesChannel: "TIENDA",
    status: "PAID",
    daysAgo: 3,
  },
  {
    customerIndex: 0,
    productCode: "FIN-ACC-001-ROS",
    quantity: 1,
    unitPrice: "90.00",
    discount: "0",
    shippingAmount: "0",
    advanceAmount: "90.00",
    totalAmount: "90.00",
    paymentMethod: "CASH",
    salesChannel: "WHATSAPP_DIRECTO",
    status: "PAID",
    daysAgo: 1,
  },
];

const FIN_PREFIX = "FIN27";

function toDecimal2(value: number | string): string {
  const n = Number(value);
  if (Number.isNaN(n)) return "0.00";
  return n.toFixed(2);
}

function divideCentsToPen4(cents: number, qty: number): string {
  if (qty <= 0) return "0.0000";
  return (cents / qty / 100).toFixed(4);
}

async function upsertUser(u: SeedUser): Promise<{ id: string }> {
  const passwordHash = await bcrypt.hash(u.password, 10);
  return prisma.user.upsert({
    where: { email: u.email },
    update: { name: u.name, role: u.role, isActive: true, passwordHash },
    create: {
      email: u.email,
      name: u.name,
      role: u.role,
      isActive: true,
      passwordHash,
    },
  });
}

async function ensureSettings() {
  await prisma.businessSettings.upsert({
    where: { id: "default" },
    update: { ...SETTINGS_OVERRIDE },
    create: {
      id: "default",
      ...DEFAULT_BUSINESS_SETTINGS,
      ...SETTINGS_OVERRIDE,
    },
  });
  console.log("✔ SETTINGS default");
}

async function ensureCategories() {
  for (const c of SEED_CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, isActive: true },
      create: { name: c.name, slug: c.slug, isActive: true },
    });
    console.log(`✔ CATEGORY ${c.slug}`);
  }
}

type BatchItemPayload = { variantId: string; quantity: number; unitCostUsd: string };
type BatchPayload = {
  code: string;
  purchaseDate: Date;
  shopper: string;
  agency: string;
  totalAdditionalCostsUsd: string;
  exchangeRate: string;
  status: "PURCHASED" | "IN_TRANSIT" | "COMPLETE" | "CLOSED";
  distributionMethod: CostAllocationMethod;
  notes: string;
};

function batchTotalInvestmentCents(input: {
  items: BatchItemPayload[];
  additionalUsd: string;
  exchangeRate: string;
}): number {
  const baseCents = input.items.reduce(
    (acc, it) => acc + Math.round(Number(it.unitCostUsd) * 100) * it.quantity,
    0,
  );
  const additionalCents = Math.round(
    Number(input.additionalUsd) * 100 * Number(input.exchangeRate),
  );
  return baseCents + additionalCents;
}

async function ensureBatch(payload: BatchPayload, items: BatchItemPayload[]) {
  const exchangeRate = Number(payload.exchangeRate);
  const totalInvestmentCents = batchTotalInvestmentCents({
    items,
    additionalUsd: payload.totalAdditionalCostsUsd,
    exchangeRate: payload.exchangeRate,
  });
  const totalCostUsdCents = items.reduce(
    (acc, it) => acc + Math.round(Number(it.unitCostUsd) * 100) * it.quantity,
    0,
  );
  const baseData = {
    purchaseDate: payload.purchaseDate,
    shopper: payload.shopper,
    agency: payload.agency,
    totalCostUsd: toDecimal2(totalCostUsdCents / 100),
    totalAdditionalCostsUsd: payload.totalAdditionalCostsUsd,
    totalAdditionalCostsPen: toDecimal2(
      Number(payload.totalAdditionalCostsUsd) * exchangeRate,
    ),
    exchangeRate: payload.exchangeRate,
    totalInvestmentPen: toDecimal2(totalInvestmentCents / 100),
    status: payload.status,
    distributionMethod: payload.distributionMethod,
    distributionBreakdown: { method: payload.distributionMethod },
    lastRecalculatedAt: payload.purchaseDate,
    notes: payload.notes,
  };
  const created = await prisma.importBatch.upsert({
    where: { code: payload.code },
    update: baseData,
    create: { code: payload.code, ...baseData },
  });
  for (const item of items) {
    const unitCostPen = Number(item.unitCostUsd) * exchangeRate;
    const subtotalPen = unitCostPen * item.quantity;
    const itemData = {
      quantityPurchased: item.quantity,
      quantityReceived: item.quantity,
      quantityAvailable: item.quantity,
      unitCostUsd: item.unitCostUsd,
      unitCostPen: unitCostPen.toFixed(4),
      weight: "0",
      subtotalUsd: toDecimal2(Number(item.unitCostUsd) * item.quantity),
      subtotalPen: toDecimal2(subtotalPen),
      additionalCostPen: "0.0000",
      additionalSubtotalPen: "0.00",
      landedUnitCostPen: unitCostPen.toFixed(4),
      landedSubtotalPen: toDecimal2(subtotalPen),
      distributionBreakdown: undefined as never,
      calculatedAt: payload.purchaseDate,
    };
    await prisma.importBatchItem.upsert({
      where: {
        batchId_variantId: { batchId: created.id, variantId: item.variantId },
      },
      update: itemData,
      create: { batchId: created.id, variantId: item.variantId, ...itemData },
    });
  }
  return created;
}

async function ensureVariants(): Promise<Map<string, { productId: string; variantId: string }>> {
  const categoryMap = new Map<string, { id: string }>();
  const categories = await prisma.category.findMany({
    where: { slug: { in: SEED_CATEGORIES.map((c) => c.slug) } },
    select: { id: true, slug: true },
  });
  for (const c of categories) {
    if (c.slug) categoryMap.set(c.slug, { id: c.id });
  }

  const out = new Map<string, { productId: string; variantId: string }>();
  for (const seed of SEED_PRODUCTS) {
    const category = categoryMap.get(seed.categorySlug);
    if (!category) throw new Error(`Categoria no encontrada: ${seed.categorySlug}`);

    const variant = await prisma.productVariant.upsert({
      where: { code: seed.code },
      update: {
        color: seed.color,
        material: seed.material,
        size: seed.size,
        price: seed.price,
        stock: seed.stock,
        reservedStock: 0,
        soldStock: 0,
        status: "ACTIVE",
      },
      create: {
        product: {
          create: {
            name: seed.name,
            isActive: true,
            categoryId: category.id,
          },
        },
        code: seed.code,
        color: seed.color,
        material: seed.material,
        size: seed.size,
        price: seed.price,
        stock: seed.stock,
        reservedStock: 0,
        soldStock: 0,
        status: "ACTIVE",
      },
    });
    const productRow = await prisma.product.findFirst({
      where: { variants: { some: { id: variant.id } } },
      select: { id: true },
    });
    if (!productRow) {
      throw new Error(`Producto no encontrado para variante ${seed.code}`);
    }
    await prisma.product.update({
      where: { id: productRow.id },
      data: { name: seed.name, isActive: true, categoryId: category.id },
    });

    await prisma.inventoryMovement.deleteMany({
      where: { variantId: variant.id, reason: "FIN27 seed" },
    });
    await prisma.inventoryMovement.create({
      data: {
        variantId: variant.id,
        type: "IN",
        quantity: seed.stock,
        reason: "FIN27 seed",
      },
    });

    out.set(seed.code, { productId: productRow.id, variantId: variant.id });
    console.log(`✔ PRODUCT ${seed.code} (${seed.stock} uds)`);
  }
  return out;
}

function batchItemsForRentable(
  variantByCode: Map<string, { productId: string; variantId: string }>,
  plan: BatchPlanRentable,
  layer: "old" | "new",
): BatchItemPayload[] {
  const out: BatchItemPayload[] = [];
  for (const seed of SEED_PRODUCTS) {
    if (seed.batch?.kind !== "rentable") continue;
    if (seed.batch.batchCode !== plan.batchCode) continue;
    const variant = variantByCode.get(seed.code);
    if (!variant) continue;
    out.push({
      variantId: variant.variantId,
      quantity: layer === "old" ? seed.batch.oldQuantity : seed.batch.newQuantity,
      unitCostUsd: layer === "old" ? seed.batch.oldUnitCostUsd : seed.batch.newUnitCostUsd,
    });
  }
  return out;
}

function batchItemsForCode(
  variantByCode: Map<string, { productId: string; variantId: string }>,
  plan: BatchPlanLowMargin | BatchPlanPartialClosed,
): BatchItemPayload[] {
  const out: BatchItemPayload[] = [];
  for (const seed of SEED_PRODUCTS) {
    if (!seed.batch) continue;
    if (seed.batch.kind === "rentable") continue;
    if (seed.batch.batchCode !== plan.batchCode) continue;
    const variant = variantByCode.get(seed.code);
    if (!variant) continue;
    out.push({
      variantId: variant.variantId,
      quantity: seed.batch.quantity,
      unitCostUsd: seed.batch.unitCostUsd,
    });
  }
  return out;
}

async function ensureBatches(
  variantByCode: Map<string, { productId: string; variantId: string }>,
) {
  const processedBatchCodes = new Set<string>();
  for (const seed of SEED_PRODUCTS) {
    if (!seed.batch) continue;
    if (seed.batch.kind === "rentable") {
      const codeKey = seed.batch.batchCode;
      if (processedBatchCodes.has(`${codeKey}-OLD`)) continue;
      processedBatchCodes.add(`${codeKey}-OLD`);
      processedBatchCodes.add(`${codeKey}-NEW`);
      const oldItems = batchItemsForRentable(variantByCode, seed.batch, "old");
      if (oldItems.length > 0) {
        await ensureBatch(
          {
            code: `${seed.batch.batchCode}-OLD`,
            purchaseDate: seed.batch.oldDate,
            shopper: seed.batch.shopper,
            agency: seed.batch.agency,
            totalAdditionalCostsUsd: "0",
            exchangeRate: seed.batch.exchangeRate,
            status: "COMPLETE",
            distributionMethod: "MIXED",
            notes: "Lote rentable - capa antigua",
          },
          oldItems,
        );
        console.log(`✔ BATCH ${seed.batch.batchCode}-OLD`);
      }
      const newItems = batchItemsForRentable(variantByCode, seed.batch, "new");
      if (newItems.length > 0) {
        await ensureBatch(
          {
            code: `${seed.batch.batchCode}-NEW`,
            purchaseDate: seed.batch.newDate,
            shopper: seed.batch.shopper,
            agency: seed.batch.agency,
            totalAdditionalCostsUsd: seed.batch.totalAdditionalCostsUsd,
            exchangeRate: seed.batch.exchangeRate,
            status: "COMPLETE",
            distributionMethod: "MIXED",
            notes: "Lote rentable - capa reciente con adicionales",
          },
          newItems,
        );
        console.log(`✔ BATCH ${seed.batch.batchCode}-NEW`);
      }
    } else if (seed.batch.kind === "low-margin") {
      const codeKey = seed.batch.batchCode;
      if (processedBatchCodes.has(codeKey)) continue;
      processedBatchCodes.add(codeKey);
      const items = batchItemsForCode(variantByCode, seed.batch);
      if (items.length === 0) continue;
      await ensureBatch(
        {
          code: seed.batch.batchCode,
          purchaseDate: seed.batch.date,
          shopper: seed.batch.shopper,
          agency: seed.batch.agency,
          totalAdditionalCostsUsd: seed.batch.totalAdditionalCostsUsd,
          exchangeRate: seed.batch.exchangeRate,
          status: "COMPLETE",
          distributionMethod: "MIXED",
          notes: "Lote con margen ajustado",
        },
        items,
      );
      console.log(`✔ BATCH ${seed.batch.batchCode}`);
    } else {
      const codeKey = seed.batch.batchCode;
      if (processedBatchCodes.has(codeKey)) continue;
      processedBatchCodes.add(codeKey);
      const items = batchItemsForCode(variantByCode, seed.batch);
      if (items.length === 0) continue;
      await ensureBatch(
        {
          code: seed.batch.batchCode,
          purchaseDate: seed.batch.date,
          shopper: seed.batch.shopper,
          agency: seed.batch.agency,
          totalAdditionalCostsUsd: seed.batch.totalAdditionalCostsUsd,
          exchangeRate: seed.batch.exchangeRate,
          status: seed.batch.status,
          distributionMethod: "MIXED",
          notes: seed.batch.status === "CLOSED" ? "Lote cerrado" : "Lote parcial",
        },
        items,
      );
      console.log(`✔ BATCH ${seed.batch.batchCode} (${seed.batch.status})`);
    }
  }
}

async function ensureCustomers(): Promise<Array<{ id: string; name: string; whatsapp: string }>> {
  const out: Array<{ id: string; name: string; whatsapp: string }> = [];
  for (const c of SEED_CUSTOMERS) {
    const customer = await prisma.customer.upsert({
      where: { whatsapp: c.whatsapp },
      update: {
        name: c.name,
        address: c.address,
        district: c.district,
        status: c.status,
        isActive: true,
      },
      create: {
        name: c.name,
        searchName: c.name.toLowerCase(),
        whatsapp: c.whatsapp,
        address: c.address,
        district: c.district,
        status: c.status,
        isActive: true,
      },
    });
    out.push({ id: customer.id, name: customer.name, whatsapp: customer.whatsapp });
    console.log(`✔ CUSTOMER ${c.name}`);
  }
  return out;
}

async function ensureLive(actorId: string) {
  const stamp = Date.now();
  const startedAt = new Date(Date.now() - SEED_LIVE.startedDaysAgo * 24 * 60 * 60 * 1000);
  const closedAt = new Date(startedAt.getTime() + SEED_LIVE.durationHours * 60 * 60 * 1000);
  await prisma.liveSession.upsert({
    where: { id: `seed-fin-live-${stamp}` },
    update: {
      name: SEED_LIVE.name,
      channel: SEED_LIVE.channel,
      status: SEED_LIVE.status,
      startedAt,
      closedAt,
      responsibleId: actorId,
    },
    create: {
      id: `seed-fin-live-${stamp}`,
      name: SEED_LIVE.name,
      channel: SEED_LIVE.channel,
      status: SEED_LIVE.status,
      startedAt,
      closedAt,
      responsibleId: actorId,
    },
  });
  console.log(`✔ LIVE ${SEED_LIVE.name}`);
}

async function ensureSales(
  actorId: string,
  variantByCode: Map<string, { productId: string; variantId: string }>,
  customers: Array<{ id: string; name: string; whatsapp: string }>,
) {
  let counter = 0;
  for (const sale of SEED_SALES) {
    counter += 1;
    const customer = customers[sale.customerIndex];
    if (!customer) continue;
    const variant = variantByCode.get(sale.productCode);
    if (!variant) continue;
    const orderNumber = `FIN27-${String(counter).padStart(4, "0")}`;
    const existing = await prisma.order.findUnique({ where: { orderNumber } });
    if (existing) {
      console.log(`↺ ORDER ${orderNumber} ya existe`);
      continue;
    }
    const orderDate = new Date(Date.now() - sale.daysAgo * 24 * 60 * 60 * 1000);
    const total = sale.totalAmount;
    const advance = sale.advanceAmount;
    const validatedPaid = sale.status === "PAID" ? total : advance;
    const balance =
      sale.status === "PAID"
        ? "0"
        : toDecimal2(Math.max(0, Number(total) - Number(advance)));
    const profitDate = sale.status === "PAID" ? orderDate : null;

    const lineSubtotal = toDecimal2(Number(sale.unitPrice) * sale.quantity);
    const lineDiscount = sale.discount;
    const lineNetRevenue = toDecimal2(
      Math.max(0, Number(lineSubtotal) - Number(sale.discount)) +
        Number(sale.shippingAmount),
    );

    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId: customer.id,
        status: sale.status,
        subtotal: lineSubtotal,
        discount: sale.discount,
        shippingAmount: sale.shippingAmount,
        total,
        validatedPaid,
        balance,
        expiresAt: new Date(orderDate.getTime() + 7 * 24 * 60 * 60 * 1000),
        salesChannel: sale.salesChannel,
        productCostPen: "0",
        grossProfitPen: "0",
        paymentFeePen: "0",
        packagingCostPen: "0",
        netProfitPen: "0",
        profitCalculatedAt: profitDate,
        createdAt: orderDate,
        updatedAt: orderDate,
      },
    });

    const item = await prisma.orderItem.create({
      data: {
        orderId: order.id,
        variantId: variant.variantId,
        quantity: sale.quantity,
        unitPrice: sale.unitPrice,
        lineTotal: lineNetRevenue,
        costSource: "BATCH",
        unitCostPen: "0.0000",
        totalCostPen: "0.00",
        netLineRevenuePen: lineNetRevenue,
        lineDiscountPen: lineDiscount,
        grossProfitPen: "0.00",
        createdAt: orderDate,
      },
    });

    let allocatedCostCents = 0;
    const batchItem = await prisma.importBatchItem.findFirst({
      where: { variantId: variant.variantId, calculatedAt: { not: null } },
      orderBy: { batch: { purchaseDate: "asc" } },
      select: { id: true, batchId: true, landedUnitCostPen: true, quantityAvailable: true },
    });
    if (batchItem) {
      const unitCostCents = Math.round(Number(batchItem.landedUnitCostPen.toString()) * 100);
      const subtotalCents = unitCostCents * sale.quantity;
      await prisma.orderItemBatchAllocation.create({
        data: {
          orderItemId: item.id,
          batchItemId: batchItem.id,
          batchId: batchItem.batchId,
          variantId: variant.variantId,
          quantity: sale.quantity,
          unitCostPen: batchItem.landedUnitCostPen.toString(),
          subtotalCostPen: toDecimal2(subtotalCents / 100),
          createdAt: orderDate,
        },
      });
      await prisma.importBatchItem.update({
        where: { id: batchItem.id },
        data: { quantityAvailable: { decrement: sale.quantity } },
      });
      allocatedCostCents = subtotalCents;
      await prisma.orderItem.update({
        where: { id: item.id },
        data: {
          unitCostPen: batchItem.landedUnitCostPen.toString(),
          totalCostPen: toDecimal2(subtotalCents / 100),
        },
      });
    }

    const netRevenueCents = Math.round(Number(lineNetRevenue) * 100);
    const grossProfitCents = netRevenueCents - allocatedCostCents;
    const profitCalcDate = sale.status === "PAID" ? orderDate : null;
    await prisma.order.update({
      where: { id: order.id },
      data: {
        productCostPen: toDecimal2(allocatedCostCents / 100),
        grossProfitPen: toDecimal2(grossProfitCents / 100),
        paymentFeePen: "0",
        packagingCostPen: "0",
        netProfitPen: toDecimal2(grossProfitCents / 100),
        profitCalculatedAt: profitCalcDate,
      },
    });
    await prisma.orderItem.update({
      where: { id: item.id },
      data: { grossProfitPen: toDecimal2(grossProfitCents / 100) },
    });

    await prisma.payment.create({
      data: {
        customerId: customer.id,
        orderId: order.id,
        method: sale.paymentMethod,
        status: "VALIDATED",
        amount: validatedPaid,
        validatedAt: sale.status === "PAID" ? orderDate : null,
        validatedById: actorId,
        createdAt: orderDate,
        updatedAt: orderDate,
      },
    });

    if (sale.status === "PAID" && allocatedCostCents === 0) {
      console.warn(`⚠ ORDER ${orderNumber} sin asignacion de lote`);
    }
    console.log(`✔ ORDER ${orderNumber} ${total} (${sale.status})`);
  }
}

async function ensureExpenses(actorId: string) {
  for (const e of SEED_EXPENSES) {
    const description = `${FIN_PREFIX} ${e.description}`;
    const existing = await prisma.expense.findFirst({
      where: { description, expenseDate: e.expenseDate },
    });
    if (existing) {
      console.log(`↺ EXPENSE ${description} ya existe`);
      continue;
    }
    await prisma.expense.create({
      data: {
        expenseDate: e.expenseDate,
        category: e.category,
        expenseType: e.expenseType,
        status: "ACTIVE",
        description,
        amount: e.amount,
        paymentMethod: e.paymentMethod,
        notes: e.notes,
        createdById: actorId,
      },
    });
    console.log(`✔ EXPENSE ${description}`);
  }
}

async function ensureIncidents(
  actorId: string,
  variantByCode: Map<string, { productId: string; variantId: string }>,
  customers: Array<{ id: string; name: string; whatsapp: string }>,
) {
  for (const inc of SEED_INCIDENTS) {
    const description = `${FIN_PREFIX} ${inc.description}`;
    const existing = await prisma.incident.findFirst({
      where: { description },
    });
    if (existing) {
      console.log(`↺ INCIDENT ${description} ya existe`);
      continue;
    }
    const incidentDate = new Date(Date.now() - inc.daysAgo * 24 * 60 * 60 * 1000);
    const variant = inc.productCode ? variantByCode.get(inc.productCode) : null;
    const customer = inc.customerIndex !== null ? customers[inc.customerIndex] : null;

    const created = await prisma.incident.create({
      data: {
        incidentDate,
        type: inc.type,
        status: inc.status,
        decision: inc.decision,
        orderId: null,
        orderItemId: null,
        variantId: variant ? variant.variantId : null,
        customerId: customer ? customer.id : null,
        quantity: inc.quantity,
        restockQuantity: inc.restockQuantity,
        description,
        recoveredAmount: inc.recoveredAmount,
        lostAmount: inc.lostAmount,
        notes: null,
        createdById: actorId,
        resolvedAt: inc.status === "RESOLVED" ? incidentDate : null,
        resolvedById: inc.status === "RESOLVED" ? actorId : null,
      },
    });

    if (inc.type === "DAMAGE" && variant && inc.status === "RESOLVED") {
      const variantRow = await prisma.productVariant.findUnique({
        where: { id: variant.variantId },
        select: { stock: true },
      });
      const newStock = Math.max(0, (variantRow?.stock ?? 0) - inc.quantity);
      await prisma.productVariant.update({
        where: { id: variant.variantId },
        data: { stock: newStock },
      });
      await prisma.inventoryMovement.create({
        data: {
          variantId: variant.variantId,
          type: "ADJUSTMENT",
          quantity: -inc.quantity,
          reason: `${FIN_PREFIX} incident ${created.id}`,
        },
      });
    }

    if (inc.type === "RETURN" && inc.decision === "CREDIT" && customer && Number(inc.recoveredAmount) > 0) {
      await prisma.customerCredit.create({
        data: {
          customerId: customer.id,
          origin: "MANUAL",
          status: "AVAILABLE",
          amount: inc.recoveredAmount,
          availableAmount: inc.recoveredAmount,
          notes: `${FIN_PREFIX} credito por devolucion`,
          createdById: actorId,
        },
      });
    }

    console.log(`✔ INCIDENT ${description}`);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL no está definida. Configura tu .env antes de ejecutar el seed.",
    );
  }

  const users: SeedUser[] = [
    readUser(
      process.env.SEED_ADMIN_EMAIL,
      process.env.SEED_ADMIN_PASSWORD,
      process.env.SEED_ADMIN_NAME,
      "ADMIN",
      { email: "admin@shoplivett.local", name: "Administrador" },
    ),
    readUser(
      process.env.SEED_SELLER_EMAIL,
      process.env.SEED_SELLER_PASSWORD,
      process.env.SEED_SELLER_NAME,
      "SELLER",
      { email: "seller@shoplivett.local", name: "Vendedora" },
    ),
    readUser(
      process.env.SEED_DISPATCH_EMAIL,
      process.env.SEED_DISPATCH_PASSWORD,
      process.env.SEED_DISPATCH_NAME,
      "DISPATCH",
      { email: "dispatch@shoplivett.local", name: "Despacho" },
    ),
  ];

  let adminId = "";
  for (const u of users) {
    const user = await upsertUser(u);
    if (u.role === "ADMIN") adminId = user.id;
    console.log(`✔ ${u.role.padEnd(8)} ${u.email}`);
  }

  await ensureSettings();
  await ensureCategories();
  const variantByCode = await ensureVariants();
  await ensureBatches(variantByCode);
  const customers = await ensureCustomers();
  await ensureLive(adminId);
  await ensureSales(adminId, variantByCode, customers);
  await ensureExpenses(adminId);
  await ensureIncidents(adminId, variantByCode, customers);

  if (users.some((u) => u.password === FALLBACK)) {
    console.warn(
      "\n⚠ Algunas contraseñas usan el valor por defecto. Define SEED_*_PASSWORD en .env y vuelve a correr el seed.",
    );
  }

  console.log("\n✔ Seed financiero Sprint 27 completo");
  console.log("  4 lotes (rentable nuevo/antiguo, margen bajo, parcial/cerrado)");
  console.log("  12 productos/variantes en 5 categorías");
  console.log("  3 clientas con 5 ventas PAID + snapshots de costo");
  console.log("  5 gastos operativos del mes");
  console.log("  2 incidencias (DAMAGE + RETURN/CREDIT)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
