import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { BulletCategory, CompanySummary, Theme } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const company = await db.company.findUnique({
    where: { id },
    include: {
      filings: {
        include: {
          sections: {
            select: {
              id: true,
              heading: true,
              category: true,
              content: true,
              orderIndex: true,
            },
            orderBy: { orderIndex: "asc" },
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
        orderBy: { year: "desc" },
      },
    },
  });

  if (!company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = {
    id: company.id,
    name: company.name,
    ticker: company.ticker,
    sector: company.sector,
    filings: company.filings.map((f) => {
      const summaries: CompanySummary[] = f.summaries.map((s) => ({
        id: s.id,
        theme: s.theme as Theme,
        score: s.score,
        scoreJustification: s.scoreJustification,
        summary: s.summary,
        bulletPoints: s.bulletPoints as unknown as BulletCategory[],
      }));

      const sectionsByTheme: Record<string, { id: string; heading: string; content: string }[]> = {};
      for (const section of f.sections) {
        const theme = section.category;
        if (!sectionsByTheme[theme]) {
          sectionsByTheme[theme] = [];
        }
        sectionsByTheme[theme].push({
          id: section.id,
          heading: section.heading,
          content: section.content,
        });
      }

      return {
        id: f.id,
        year: f.year,
        summaries,
        sectionsByTheme,
      };
    }),
  };

  return NextResponse.json(result);
}
