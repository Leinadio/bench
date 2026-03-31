import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { filingIds, category } = await request.json();

  if (!filingIds || !Array.isArray(filingIds) || filingIds.length < 2) {
    return NextResponse.json(
      { error: "Need at least 2 filingIds" },
      { status: 400 }
    );
  }

  const results = await Promise.all(
    filingIds.map(async (filingId: string) => {
      const filing = await db.filing.findUnique({
        where: { id: filingId },
        include: {
          company: { select: { name: true, ticker: true } },
          sections: {
            where: category ? { category } : undefined,
            select: {
              id: true,
              heading: true,
              depth: true,
              category: true,
              content: true,
              orderIndex: true,
            },
            orderBy: { orderIndex: "asc" },
          },
        },
      });
      return filing;
    })
  );

  return NextResponse.json(results.filter(Boolean));
}
