import { db } from "../src/lib/db";

async function main() {
  const items = await db.riskFactorItem.deleteMany({});
  const factors = await db.riskFactor.deleteMany({});
  const cats = await db.riskCategory.deleteMany({});
  console.log(`Deleted ${items.count} items, ${factors.count} factors, ${cats.count} categories`);
  await db.$disconnect();
}

main().catch(console.error);
