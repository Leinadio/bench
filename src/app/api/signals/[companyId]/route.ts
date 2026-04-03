import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchNews } from "@/lib/news";
import Anthropic from "@anthropic-ai/sdk";
import type { Signal } from "@/lib/types";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const CACHE_DIR = join(process.cwd(), "data", "signals");

async function readCache(companyId: string) {
  try {
    const raw = await readFile(join(CACHE_DIR, `${companyId}.json`), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeCache(companyId: string, data: object) {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(join(CACHE_DIR, `${companyId}.json`), JSON.stringify(data, null, 2));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";

  // Serve from file cache if available
  if (!refresh) {
    const cached = await readCache(companyId);
    if (cached) return NextResponse.json(cached);
  }

  const company = await db.company.findUnique({
    where: { id: companyId },
    include: {
      summaries: {
        select: { theme: true, score: true },
      },
    },
  });

  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const articles = await fetchNews(company.name, company.ticker);

  if (articles.length === 0) {
    const result = {
      signals: [],
      companyName: company.name,
      analyzedAt: new Date().toISOString(),
      articleCount: 0,
    };
    await writeCache(companyId, result);
    return NextResponse.json(result);
  }

  const scores = company.summaries
    .filter((s) => s.theme !== "global")
    .map((s) => `${s.theme} ${s.score}/5`)
    .join(", ");

  const articlesList = articles
    .map((a, i) => `${i + 1}. ${a.title} | ${a.url}`)
    .join("\n");

  let signals: Signal[] = [];
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      messages: [
        {
          role: "user",
          content: `${company.name} (${company.ticker}, ${company.sector}). Scores DEU: ${scores}.

Actualités:
${articlesList}

3-5 signaux JSON. Chaque signal: type (positive/negative/neutral), title, summary (1 phrase), theme (risk/strategy/governance/esg/financial ou null), sourceUrl, date (JJ/MM/AAAA), relatedRisks (liste courte).
JSON uniquement, pas de markdown:`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "[]";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    signals = JSON.parse(arrayMatch ? arrayMatch[0] : "[]");
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error("[signals] Error:", errorMsg);
    return NextResponse.json({
      signals: [],
      companyName: company.name,
      analyzedAt: new Date().toISOString(),
      articleCount: articles.length,
      error: errorMsg,
    });
  }

  const result = {
    signals,
    companyName: company.name,
    analyzedAt: new Date().toISOString(),
    articleCount: articles.length,
  };

  await writeCache(companyId, result);

  return NextResponse.json(result);
}
