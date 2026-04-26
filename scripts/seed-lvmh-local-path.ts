import { db } from "../src/lib/db";

async function main() {
  const company = await db.company.findUnique({ where: { ticker: "MC" } });
  if (!company) {
    console.error("Company MC not found");
    process.exit(1);
  }

  const filing = await db.filing.findFirst({
    where: { companyId: company.id, status: { not: "pending" } },
    orderBy: { year: "desc" },
  });

  if (!filing) {
    console.error("No non-pending filing found for MC.PA");
    process.exit(1);
  }

  await db.filing.update({
    where: { id: filing.id },
    data: { localPath: "/Users/danieldupont/Developer/Projects/bench/rapports/deu_lvmh_2025.xhtml" },
  });

  console.log(`Updated filing ${filing.id} (year ${filing.year}) with localPath`);
  await db.$disconnect();
}

main().catch(console.error);
