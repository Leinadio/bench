import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { askQuestion } from "@/lib/claude";

export async function POST(request: NextRequest) {
  const { question, filingId } = await request.json();

  if (!question || !filingId) {
    return NextResponse.json(
      { error: "Missing question or filingId" },
      { status: 400 }
    );
  }

  const relevantSections = await db.$queryRawUnsafe<
    { heading: string; category: string; content: string }[]
  >(
    `SELECT heading, category, content
     FROM "Section"
     WHERE "filingId" = $1
       AND search_vector @@ plainto_tsquery('french', $2)
     ORDER BY ts_rank(search_vector, plainto_tsquery('french', $2)) DESC
     LIMIT 10`,
    filingId,
    question
  );

  let context: string;

  if (relevantSections.length === 0) {
    const fallback = await db.section.findMany({
      where: { filingId },
      select: { heading: true, category: true, content: true },
      orderBy: { orderIndex: "asc" },
      take: 15,
    });
    context = fallback
      .map((s) => `### ${s.heading} [${s.category}]\n${s.content}`)
      .join("\n\n---\n\n");
  } else {
    context = relevantSections
      .map((s) => `### ${s.heading} [${s.category}]\n${s.content}`)
      .join("\n\n---\n\n");
  }

  const trimmedContext = context.substring(0, 50000);
  const answer = await askQuestion(question, trimmedContext);

  return NextResponse.json({
    answer,
    sourceSections: relevantSections.map((s) => s.heading),
  });
}
