import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { RiskFactorsResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function extractImpactLevel(text: string): string | null {
  const lower = text.toLowerCase();
  const match =
    lower.match(/impact\s*(?:potentiel|financier|estimé)?\s*[:\-]\s*([^\n,;.<]{1,30})/i) ||
    lower.match(/niveau\s*(?:d['']impact|de risque)?\s*[:\-]\s*([^\n,;.<]{1,30})/i);
  if (!match) return null;
  return match[1].trim().replace(/\s+/g, " ");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;

  try {
    const company = await db.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return NextResponse.json(
        { riskFactors: [], status: "error", message: "Entreprise introuvable." } satisfies RiskFactorsResponse,
        { status: 404 }
      );
    }

    const filing = await db.filing.findFirst({
      where: { companyId, status: { not: "pending" } },
      orderBy: { year: "desc" },
    });

    if (!filing) {
      return NextResponse.json({
        riskFactors: [],
        status: "no_filing",
        message: "Aucun dépôt disponible pour cette entreprise.",
      } satisfies RiskFactorsResponse);
    }

    // Check cache
    const existing = await db.riskFactor.findMany({
      where: { filingId: filing.id },
      orderBy: { orderIndex: "asc" },
    });

    if (existing.length > 0) {
      return NextResponse.json({
        riskFactors: existing.map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description,
          impactLevel: r.impactLevel,
          orderIndex: r.orderIndex,
        })),
        status: "cached",
        filingYear: filing.year,
        extractedAt: existing[0].extractedAt.toISOString(),
      } satisfies RiskFactorsResponse);
    }

    // Extract from sections
    const sections = await db.section.findMany({
      where: { filingId: filing.id, category: "risk" },
      orderBy: { orderIndex: "asc" },
    });

    if (sections.length === 0) {
      return NextResponse.json({
        riskFactors: [],
        status: "no_sections",
        message: "Aucune section de facteurs de risque trouvée dans ce dépôt.",
      } satisfies RiskFactorsResponse);
    }

    // Prefer sub-sections (depth > 1), fall back to top-level sections
    const subSections = sections.filter((s) => s.depth > 1);
    const source = subSections.length > 0 ? subSections : sections;

    const toCreate = source.map((s, i) => ({
      companyId,
      filingId: filing.id,
      title: s.heading,
      description: s.content,
      impactLevel: extractImpactLevel(s.heading + " " + s.content),
      orderIndex: i,
    }));

    await db.riskFactor.createMany({ data: toCreate, skipDuplicates: true });

    const stored = await db.riskFactor.findMany({
      where: { filingId: filing.id },
      orderBy: { orderIndex: "asc" },
    });

    return NextResponse.json({
      riskFactors: stored.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        impactLevel: r.impactLevel,
        orderIndex: r.orderIndex,
      })),
      status: "extracted",
      filingYear: filing.year,
      extractedAt: stored[0]!.extractedAt.toISOString(),
    } satisfies RiskFactorsResponse);
  } catch (err) {
    console.error("[risk-factors] Fatal error:", err);
    return NextResponse.json(
      { riskFactors: [], status: "error", message: "Erreur lors de la récupération des facteurs de risque." } satisfies RiskFactorsResponse,
      { status: 500 }
    );
  }
}
