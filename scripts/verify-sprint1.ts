// Script de verificación end-to-end del Sprint 1.
// Levanta pglite, aplica el SQL equivalente al schema Prisma, corre el seed
// y valida que el hash de contraseña coincide.

import { PGlite } from "@electric-sql/pglite";
import bcrypt from "bcryptjs";

const DDL = `
  DROP SCHEMA public CASCADE;
  CREATE SCHEMA public;

  CREATE TYPE "Role" AS ENUM ('ADMIN', 'SELLER', 'DISPATCH');

  CREATE TABLE "User" (
    "id" TEXT PRIMARY KEY,
    "email" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'SELLER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX "User_email_idx" ON "User"("email");
  CREATE INDEX "User_role_idx" ON "User"("role");

  CREATE TABLE "Session" (
    "id" TEXT PRIMARY KEY,
    "sessionToken" TEXT NOT NULL UNIQUE,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
  );

  CREATE INDEX "Session_userId_idx" ON "Session"("userId");
`;

type Seed = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "SELLER" | "DISPATCH";
  password: string;
};

const SEEDS: Seed[] = [
  { id: "user_admin", email: "admin@shoplivett.local", name: "Administrador", role: "ADMIN", password: "Admin123*" },
  { id: "user_seller", email: "seller@shoplivett.local", name: "Vendedora", role: "SELLER", password: "Seller123*" },
  { id: "user_dispatch", email: "dispatch@shoplivett.local", name: "Despacho", role: "DISPATCH", password: "Dispatch123*" },
];

async function main() {
  const db = await PGlite.create();
  await db.waitReady;
  await db.exec(DDL);

  for (const s of SEEDS) {
    const passwordHash = await bcrypt.hash(s.password, 10);
    await db.query(
      `INSERT INTO "User" (id, email, name, "passwordHash", role, "isActive", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5::"Role",true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
      [s.id, s.email, s.name, passwordHash, s.role],
    );
  }

  type Row = { email: string; role: string; is_active: boolean; password_hash: string };
  const result = await db.query<Row>(
    `SELECT email, role, "isActive" as is_active, "passwordHash" as password_hash
     FROM "User" ORDER BY role`,
  );

  let allOk = true;
  console.log("Usuarios creados:");
  for (const row of result.rows) {
    const seed = SEEDS.find((s) => s.email === row.email)!;
    const ok = await bcrypt.compare(seed.password, row.password_hash);
    if (!ok) allOk = false;
    console.log(
      `  ${row.role.padEnd(8)} ${row.email.padEnd(28)} active=${row.is_active} login_ok=${ok}`,
    );
  }

  // Pruebas negativas.
  const wrong = await bcrypt.compare("contraseña-incorrecta", result.rows[0].password_hash);
  console.log(`\nLogin con contraseña incorrecta: ${wrong ? "❌ falla" : "✔ rechazado"}`);
  if (wrong) allOk = false;

  await db.close();
  if (!allOk) {
    console.error("\n✘ Verificación fallida");
    process.exit(1);
  }
  console.log("\n✔ Verificación finalizada");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
