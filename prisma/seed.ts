import "dotenv/config";

import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { DEFAULT_BUSINESS_SETTINGS } from "../lib/settings-defaults";

type SeedUser = {
  role: Role;
  email: string;
  name: string;
  password: string;
};

const FALLBACK = "change-me-in-env";

function readUser(
  envEmail: string | undefined,
  envPassword: string | undefined,
  envName: string | undefined,
  role: Role,
  defaults: { email: string; name: string },
): SeedUser {
  return {
    role,
    email: envEmail || defaults.email,
    name: envName || defaults.name,
    password: envPassword || FALLBACK,
  };
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

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
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
    console.log(`✔ ${u.role.padEnd(8)} ${u.email}`);
  }

  await prisma.businessSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      reservationDays: DEFAULT_BUSINESS_SETTINGS.reservationDays,
      minimumAdvance: DEFAULT_BUSINESS_SETTINGS.minimumAdvance,
      currency: DEFAULT_BUSINESS_SETTINGS.currency,
      freeShippingEnabled: DEFAULT_BUSINESS_SETTINGS.freeShippingEnabled,
      freeShippingThreshold: DEFAULT_BUSINESS_SETTINGS.freeShippingThreshold,
      productCodePrefix: DEFAULT_BUSINESS_SETTINGS.productCodePrefix,
      allowOverpaymentCredit: DEFAULT_BUSINESS_SETTINGS.allowOverpaymentCredit,
      allowRefund: DEFAULT_BUSINESS_SETTINGS.allowRefund,
      enabledPaymentMethods: DEFAULT_BUSINESS_SETTINGS.enabledPaymentMethods,
      enabledShippingMethods: DEFAULT_BUSINESS_SETTINGS.enabledShippingMethods,
      paymentValidatorRoles: DEFAULT_BUSINESS_SETTINGS.paymentValidatorRoles,
    },
  });
  console.log("✔ SETTINGS default");

  if (users.some((u) => u.password === FALLBACK)) {
    console.warn(
      "\n⚠ Algunas contraseñas usan el valor por defecto. Define SEED_*_PASSWORD en .env y vuelve a correr el seed.",
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
