import type { PrismaClient } from "@prisma/client";

export async function getLastSoldByVariant(
  client: Pick<PrismaClient, "orderItem">,
  variantIds: string[],
): Promise<Map<string, Date>> {
  const lastSoldByVariant = new Map<string, Date>();
  if (variantIds.length === 0) return lastSoldByVariant;

  const rows = await client.orderItem.groupBy({
    by: ["variantId"],
    where: {
      variantId: { in: variantIds },
      order: { status: "PAID" },
    },
    _max: { createdAt: true },
  });

  for (const row of rows) {
    const maxDate = row._max.createdAt;
    if (maxDate) lastSoldByVariant.set(row.variantId, maxDate);
  }

  return lastSoldByVariant;
}
