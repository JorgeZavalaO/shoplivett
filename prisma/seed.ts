// Placeholder. En Sprint 1 se agregará el seed del usuario administrador.
async function main() {
  console.log("Seed placeholder. Implementar en Sprint 1.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await import("@/lib/prisma").then(({ prisma }) => prisma.$disconnect());
  });
