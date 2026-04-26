import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseXhtmlRiskFactors } from "@/lib/xhtml-risk-parser";
import type { RiskCategory, RiskFactorsResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;

  try {
    const company = await db.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return NextResponse.json(
        { categories: [], status: "error", message: "Entreprise introuvable." } satisfies RiskFactorsResponse,
        { status: 404 }
      );
    }

    const filing = await db.filing.findFirst({
      where: { companyId, status: { not: "pending" } },
      orderBy: { year: "desc" },
    });

    if (!filing) {
      return NextResponse.json({
        categories: [],
        status: "no_filing",
        message: "Aucun dépôt disponible pour cette entreprise.",
      } satisfies RiskFactorsResponse);
    }

    // Check cache
    const existingCategories = await db.riskCategory.findMany({
      where: { filingId: filing.id },
      orderBy: { orderIndex: "asc" },
      include: {
        factors: {
          orderBy: { orderIndex: "asc" },
          include: { items: { orderBy: { orderIndex: "asc" } } },
        },
      },
    });

    if (existingCategories.length > 0) {
      const categories: RiskCategory[] = existingCategories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        orderIndex: cat.orderIndex,
        factors: cat.factors.map((f) => ({
          id: f.id,
          sectionRef: f.sectionRef,
          title: f.title,
          criticalityScore: f.criticalityScore,
          orderIndex: f.orderIndex,
          items: f.items.map((item) => ({
            id: item.id,
            description: item.description,
            riskManagement: item.riskManagement,
            orderIndex: item.orderIndex,
          })),
        })),
      }));
      return NextResponse.json({
        categories,
        status: "cached",
        filingYear: filing.year,
        extractedAt: existingCategories[0].extractedAt.toISOString(),
      } satisfies RiskFactorsResponse);
    }

    // No cache: need local XHTML file
    if (!filing.localPath) {
      return NextResponse.json({
        categories: [],
        status: "no_local_path",
        message: "Aucun fichier local configuré pour ce dépôt.",
      } satisfies RiskFactorsResponse);
    }

    // Parse XHTML and persist
    const parsed = parseXhtmlRiskFactors(filing.localPath);

    if (parsed.length === 0) {
      return NextResponse.json({
        categories: [],
        status: "no_sections",
        message: "Aucun facteur de risque trouvé dans le fichier.",
      } satisfies RiskFactorsResponse);
    }

    let globalFactorIndex = 0;
    const createdCategories: RiskCategory[] = [];

    for (const parsedCat of parsed) {
      const cat = await db.riskCategory.create({
        data: {
          companyId,
          filingId: filing.id,
          name: parsedCat.name,
          orderIndex: parsedCat.orderIndex,
        },
      });

      const factors: RiskCategory["factors"] = [];
      for (const f of parsedCat.factors) {
        const factor = await db.riskFactor.create({
          data: {
            companyId,
            filingId: filing.id,
            categoryId: cat.id,
            sectionRef: f.sectionRef,
            title: f.title,
            criticalityScore: f.criticalityScore,
            orderIndex: globalFactorIndex++,
          },
        });

        const items = await db.riskFactorItem.createManyAndReturn({
          data: f.items.map((item) => ({
            factorId: factor.id,
            description: item.description,
            riskManagement: item.riskManagement,
            orderIndex: item.orderIndex,
          })),
        });

        factors.push({
          id: factor.id,
          sectionRef: factor.sectionRef,
          title: factor.title,
          criticalityScore: factor.criticalityScore,
          orderIndex: factor.orderIndex,
          items: items.map((item) => ({
            id: item.id,
            description: item.description,
            riskManagement: item.riskManagement,
            orderIndex: item.orderIndex,
          })),
        });
      }

      createdCategories.push({
        id: cat.id,
        name: cat.name,
        orderIndex: cat.orderIndex,
        factors,
      });
    }

    return NextResponse.json({
      categories: createdCategories,
      status: "extracted",
      filingYear: filing.year,
      extractedAt: new Date().toISOString(),
    } satisfies RiskFactorsResponse);
  } catch (err) {
    console.error("[risk-factors] Fatal error:", err);
    return NextResponse.json(
      { categories: [], status: "error", message: "Erreur lors de la récupération des facteurs de risque." } satisfies RiskFactorsResponse,
      { status: 500 }
    );
  }
}
