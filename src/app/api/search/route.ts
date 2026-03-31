import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");
  const category = request.nextUrl.searchParams.get("category");
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "20");

  if (!query) {
    return NextResponse.json({ error: "Missing q parameter" }, { status: 400 });
  }

  let results: unknown[];

  if (category) {
    results = await db.$queryRawUnsafe(
      `SELECT
        s.id,
        s.heading,
        s.category,
        s.content,
        c.name as "companyName",
        c.ticker as "companyTicker",
        f.year as "filingYear",
        ts_rank(s.search_vector, plainto_tsquery('french', $1)) as rank
      FROM "Section" s
      JOIN "Filing" f ON f.id = s."filingId"
      JOIN "Company" c ON c.id = f."companyId"
      WHERE s.search_vector @@ plainto_tsquery('french', $1)
        AND s.category = $2
      ORDER BY rank DESC
      LIMIT $3`,
      query,
      category,
      limit
    );
  } else {
    results = await db.$queryRawUnsafe(
      `SELECT
        s.id,
        s.heading,
        s.category,
        s.content,
        c.name as "companyName",
        c.ticker as "companyTicker",
        f.year as "filingYear",
        ts_rank(s.search_vector, plainto_tsquery('french', $1)) as rank
      FROM "Section" s
      JOIN "Filing" f ON f.id = s."filingId"
      JOIN "Company" c ON c.id = f."companyId"
      WHERE s.search_vector @@ plainto_tsquery('french', $1)
      ORDER BY rank DESC
      LIMIT $2`,
      query,
      limit
    );
  }

  const searchResults = (results as Record<string, unknown>[]).map((r) => ({
    ...r,
    rank: Number(r.rank),
    snippet:
      String(r.content).substring(0, 300) +
      (String(r.content).length > 300 ? "..." : ""),
  }));

  return NextResponse.json(searchResults);
}
