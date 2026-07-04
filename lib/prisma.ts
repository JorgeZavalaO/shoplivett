import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

export type PrismaTransactionClient = Prisma.TransactionClient;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL no está definida en las variables de entorno.");
  }
  const adapter = new PrismaPg({ connectionString });
  const logLevels: Prisma.LogLevel[] =
    process.env.NODE_ENV === "development"
      ? ["error", "warn"]
      : ["error"];
  // PRISMA_LOG_QUERY=1 emite 'query' como evento (`emit: 'event'`) para
  // que los tests de regresion puedan contar sentencias via `$on('query')`.
  // Mantenemos 'stdout' cuando no se requiere instrumentacion para no
  // contaminar la salida de los tests ordinarios.
  const log: Array<Prisma.LogLevel | Prisma.LogDefinition> =
    process.env.PRISMA_LOG_QUERY === "1"
      ? [{ level: "query", emit: "event" }]
      : logLevels;
  return new PrismaClient({
    adapter,
    log,
  });
}

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getPrisma(), prop, receiver);
  },
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = getPrisma();
}
