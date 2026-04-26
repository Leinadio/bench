import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { BulletCategory, CompanySummary, Theme } from "@/lib/types";

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
      summaries: {
        select: {
          id: true,
          theme: true,
          score: true,
          scoreJustification: true,
          summary: true,
          bulletPoints: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const result = companies.map((c) => {
    const summaries: CompanySummary[] = c.summaries.map((s) => ({
      id: s.id,
      theme: s.theme as Theme,
      score: s.score,
      scoreJustification: s.scoreJustification,
      summary: s.summary,
      bulletPoints: s.bulletPoints as unknown as BulletCategory[],
    }));

    return {
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
      globalSummary: summaries.find((s) => s.theme === "global") || null,
    };
  });

  return NextResponse.json(result);
}
