import { prisma } from "../lib/prisma";

async function main() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  console.log("EXPLAIN ANALYZE - sales by month raw SQL");
  const salesPlan = await prisma.$queryRawUnsafe<Array<{ "QUERY PLAN": string }>>(
    `EXPLAIN ANALYZE
     SELECT
       date_trunc('month', "profitCalculatedAt") AS bucket,
       COUNT(*)::bigint AS count,
       SUM("total") AS total,
       SUM("productCostPen") AS product_cost,
       SUM("grossProfitPen") AS gross_profit,
       SUM("paymentFeePen") AS payment_fee,
       SUM("packagingCostPen") AS packaging_cost,
       SUM("deliveryBusinessCostPen") AS delivery_business_cost
     FROM "Order"
     WHERE "status" = 'PAID'
       AND "profitCalculatedAt" >= $1
       AND "profitCalculatedAt" <= $2
     GROUP BY 1
     ORDER BY 1 ASC`,
    from,
    to,
  );
  for (const row of salesPlan) console.log(row["QUERY PLAN"]);

  console.log("\nEXPLAIN ANALYZE - overview aggregate");
  const overviewPlan = await prisma.$queryRawUnsafe<Array<{ "QUERY PLAN": string }>>(
    `EXPLAIN ANALYZE
     SELECT
       SUM("total"),
       SUM("productCostPen"),
       SUM("grossProfitPen"),
       SUM("paymentFeePen"),
       SUM("packagingCostPen"),
       SUM("deliveryBusinessCostPen")
     FROM "Order"
     WHERE "status" = 'PAID'
       AND "profitCalculatedAt" >= $1
       AND "profitCalculatedAt" <= $2`,
    from,
    to,
  );
  for (const row of overviewPlan) console.log(row["QUERY PLAN"]);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
