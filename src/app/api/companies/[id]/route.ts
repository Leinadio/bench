import { NextResponse } from "next/server";
import { db } from "@/lib/db";

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
              depth: true,
              category: true,
              content: true,
              orderIndex: true,
            },
            orderBy: { orderIndex: "asc" },
          },
        },
        orderBy: { year: "desc" },
      },
    },
  });

  if (!company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(company);
}
