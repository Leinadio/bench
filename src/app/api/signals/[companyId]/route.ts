import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Signal } from "@/lib/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;

  const allSignals = await db.signal.findMany({
    where: { companyId },
    orderBy: { analyzedAt: "desc" },
  });

  const signals: Signal[] = allSignals.map((s) => ({
    type: s.type as Signal["type"],
    title: s.title,
    summary: s.summary,
    justification: s.justification,
    theme: (s.theme as Signal["theme"]) ?? null,
    sourceUrl: s.sourceUrl,
    date: s.date,
    relatedRisks: s.relatedRisks as string[],
  }));

  return NextResponse.json({
    signals,
    companyName: "",
    analyzedAt: allSignals[0]?.analyzedAt.toISOString() ?? null,
    articleCount: signals.length,
  });
}
