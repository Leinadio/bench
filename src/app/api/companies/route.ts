import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const companies = await db.company.findMany({
    include: {
      filings: {
        select: {
          id: true,
          year: true,
          status: true,
          _count: { select: { sections: true } },
        },
        orderBy: { year: "desc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const result = companies.map((c) => ({
    id: c.id,
    name: c.name,
    ticker: c.ticker,
    index: c.index,
    sector: c.sector,
    filings: c.filings.map((f) => ({
      id: f.id,
      year: f.year,
      status: f.status,
      sectionCount: f._count.sections,
    })),
  }));

  return NextResponse.json(result);
}
