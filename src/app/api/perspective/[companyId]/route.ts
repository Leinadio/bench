import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import {
  buildPerspectivePrompt,
  computeSignalMetrics,
  getPerspectiveInputs,
} from "@/lib/perspective-prompt";
import type { Bias, Conviction, PerspectiveResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const PERSPECTIVE_MODEL =
  process.env.PERSPECTIVE_MODEL || "claude-haiku-4-5-20251001";
const MIN_SIGNALS = 3;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VALID_BIASES: Bias[] = [
  "fortement_haussier",
  "prudemment_haussier",
  "neutre",
  "prudemment_baissier",
  "fortement_baissier",
];
const VALID_CONVICTIONS: Conviction[] = ["faible", "moyenne", "forte"];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;

  try {
    // 1. Find the company
    const company = await db.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      return NextResponse.json(
        { perspective: null, status: "error", message: "Company not found" } satisfies PerspectiveResponse,
        { status: 404 }
      );
    }

    // 2. Check cached perspective
    const existing = await db.perspective.findUnique({
      where: { companyId },
    });

    if (
      existing &&
      company.lastPerspectiveRefresh &&
      Date.now() - company.lastPerspectiveRefresh.getTime() < CACHE_TTL_MS
    ) {
      return NextResponse.json({
        perspective: {
          bias: existing.bias as Bias,
          conviction: existing.conviction as Conviction,
          summary: existing.summary,
          risks: existing.risks as { title: string; description: string }[],
          catalysts: existing.catalysts as { title: string; description: string }[],
          metrics: existing.metrics as {
            signalsBullish: number;
            signalsBearish: number;
            signalsNeutral: number;
            riskScore: number | null;
            strategyScore: number | null;
            totalSignals: number;
          },
          generatedAt: existing.generatedAt.toISOString(),
        },
        status: "cached",
      } satisfies PerspectiveResponse);
    }

    // 3. Get signals and summaries
    const { signals, summaries } = await getPerspectiveInputs(companyId);

    if (signals.length < MIN_SIGNALS) {
      return NextResponse.json({
        perspective: null,
        status: "insufficient_data",
        message: `Pas assez de signaux pour générer une perspective (${signals.length}/${MIN_SIGNALS} minimum). Visitez l'onglet Signaux pour lancer une analyse.`,
      } satisfies PerspectiveResponse);
    }

    // 4. Build prompt and call Claude
    const prompt = buildPerspectivePrompt(
      { name: company.name, ticker: company.ticker, sector: company.sector },
      signals,
      summaries
    );

    const response = await anthropic.messages.create({
      model: PERSPECTIVE_MODEL,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // 5. Parse the JSON response
    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    // Fix trailing commas
    const fixedCommas = cleaned.replace(/,\s*([}\]])/g, "$1");

    let parsed: {
      bias?: string;
      conviction?: string;
      summary?: string;
      risks?: { title: string; description: string }[];
      catalysts?: { title: string; description: string }[];
    };

    try {
      parsed = JSON.parse(fixedCommas);
    } catch (err) {
      console.error("[perspective] Failed to parse Claude response:", text.slice(0, 500), err);
      return NextResponse.json(
        {
          perspective: null,
          status: "error",
          message: "Impossible de générer la perspective",
        } satisfies PerspectiveResponse,
        { status: 500 }
      );
    }

    // 6. Validate and normalize
    const bias: Bias = VALID_BIASES.includes(parsed.bias as Bias)
      ? (parsed.bias as Bias)
      : "neutre";
    const conviction: Conviction = VALID_CONVICTIONS.includes(
      parsed.conviction as Conviction
    )
      ? (parsed.conviction as Conviction)
      : "faible";
    const summary = (parsed.summary ?? "").slice(0, 2000);
    const risks = Array.isArray(parsed.risks)
      ? parsed.risks
          .filter((r) => r && typeof r.title === "string" && typeof r.description === "string")
          .slice(0, 6)
          .map((r) => ({ title: r.title.slice(0, 200), description: r.description.slice(0, 500) }))
      : [];
    const catalysts = Array.isArray(parsed.catalysts)
      ? parsed.catalysts
          .filter((c) => c && typeof c.title === "string" && typeof c.description === "string")
          .slice(0, 6)
          .map((c) => ({ title: c.title.slice(0, 200), description: c.description.slice(0, 500) }))
      : [];

    const signalMetrics = computeSignalMetrics(signals);
    const riskScore =
      summaries.find((s) => s.theme === "risk")?.score ?? null;
    const strategyScore =
      summaries.find((s) => s.theme === "strategy")?.score ?? null;

    const metrics = {
      ...signalMetrics,
      riskScore,
      strategyScore,
    };

    // 7. Upsert perspective in DB
    const stored = await db.perspective.upsert({
      where: { companyId },
      create: {
        companyId,
        bias,
        conviction,
        summary,
        risks,
        catalysts,
        metrics,
      },
      update: {
        bias,
        conviction,
        summary,
        risks,
        catalysts,
        metrics,
        generatedAt: new Date(),
      },
    });

    // 8. Update lastPerspectiveRefresh
    await db.company.update({
      where: { id: companyId },
      data: { lastPerspectiveRefresh: new Date() },
    });

    return NextResponse.json({
      perspective: {
        bias,
        conviction,
        summary,
        risks,
        catalysts,
        metrics,
        generatedAt: stored.generatedAt.toISOString(),
      },
      status: "generated",
    } satisfies PerspectiveResponse);
  } catch (err) {
    console.error("[perspective] Fatal error:", err);
    return NextResponse.json(
      {
        perspective: null,
        status: "error",
        message: "Impossible de générer la perspective",
      } satisfies PerspectiveResponse,
      { status: 500 }
    );
  }
}
