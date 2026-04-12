# Perspective Qualitative Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Perspective" tab to the company page that displays a Claude-generated qualitative outlook synthesizing recent signals with DEU analysis — including directional bias, conviction score, synthesis paragraph, key risks, and potential catalysts.

**Architecture:** A single GET API route at `/api/perspective/[companyId]` checks a 2-hour cache TTL, then either returns the cached perspective or generates a fresh one by sending the company's 30 most recent signals + DEU summaries to Claude (Haiku for dev, Sonnet for prod). The result is stored in a `Perspective` table (one per company via upsert) and returned as plain JSON (no streaming). A new page at `/company/[id]/perspective` renders the perspective via a `PerspectivePanel` component.

**Tech Stack:** Next.js 16 App Router (Node.js runtime), Anthropic SDK (`claude-haiku-4-5-20251001` / `claude-sonnet-4-6`), Prisma 7 + adapter-pg, shadcn UI components, Tailwind CSS, Lucide icons.

**Notes for the executor:**
- The user has authorized commits — commit your work after each task with a clear conventional commit message.
- No test framework in the codebase. Verification = `npx next build` must pass after each task.
- The spec is at `docs/superpowers/specs/2026-04-12-perspective-qualitative-design.md`.

---

### Task 1: Add `Perspective` model and `lastPerspectiveRefresh` field

**Files:**
- Modify: `prisma/schema.prisma`
- Create (auto-generated): `prisma/migrations/<timestamp>_add_perspective/migration.sql`

- [ ] **Step 1: Update the schema**

In `prisma/schema.prisma`, add the `Perspective` model at the end of the file, and add two fields to the `Company` model.

First, in the `Company` model, after the `signals Signal[]` line, add:

```prisma
  perspective Perspective?
```

And after the `lastSignalRefresh DateTime?` line, add:

```prisma
  lastPerspectiveRefresh DateTime?
```

Then, at the end of the file (after the `Signal` model), add the new model:

```prisma
model Perspective {
  id        String @id @default(cuid())
  companyId String @unique
  company   Company @relation(fields: [companyId], references: [id])

  bias       String   // fortement_haussier, prudemment_haussier, neutre, prudemment_baissier, fortement_baissier
  conviction String   // faible, moyenne, forte
  summary    String
  risks      Json     // { title: string, description: string }[]
  catalysts  Json     // { title: string, description: string }[]
  metrics    Json     // { signalsBullish, signalsBearish, signalsNeutral, riskScore, strategyScore, totalSignals }

  generatedAt DateTime @default(now())
}
```

- [ ] **Step 2: Generate the migration**

Run:
```bash
npx prisma migrate dev --name add_perspective
```

Expected: a new migration directory with SQL that creates the `Perspective` table and adds the `lastPerspectiveRefresh` column to `Company`. The Prisma client is regenerated automatically.

- [ ] **Step 3: Verify build**

Run:
```bash
npx next build 2>&1 | tail -15
```

Expected: build passes with no TypeScript errors.

---

### Task 2: Add Perspective types to `src/lib/types.ts`

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add the types**

Append these types at the end of `src/lib/types.ts`:

```typescript
export type Bias =
  | "fortement_haussier"
  | "prudemment_haussier"
  | "neutre"
  | "prudemment_baissier"
  | "fortement_baissier";

export type Conviction = "faible" | "moyenne" | "forte";

export interface PerspectiveData {
  bias: Bias;
  conviction: Conviction;
  summary: string;
  risks: { title: string; description: string }[];
  catalysts: { title: string; description: string }[];
  metrics: {
    signalsBullish: number;
    signalsBearish: number;
    signalsNeutral: number;
    riskScore: number | null;
    strategyScore: number | null;
    totalSignals: number;
  };
  generatedAt: string;
}

export interface PerspectiveResponse {
  perspective: PerspectiveData | null;
  status: "cached" | "generated" | "insufficient_data" | "error";
  message?: string;
}

export const BIAS_CONFIG: Record<
  Bias,
  { label: string; color: string; bgColor: string; arrow: string }
> = {
  fortement_haussier: {
    label: "Fortement haussier",
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
    arrow: "\u2197\u2197",
  },
  prudemment_haussier: {
    label: "Prudemment haussier",
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
    arrow: "\u2197",
  },
  neutre: {
    label: "Neutre",
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-50 dark:bg-gray-900/30",
    arrow: "\u2192",
  },
  prudemment_baissier: {
    label: "Prudemment baissier",
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950/30",
    arrow: "\u2198",
  },
  fortement_baissier: {
    label: "Fortement baissier",
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950/30",
    arrow: "\u2198\u2198",
  },
};

export const CONVICTION_LABELS: Record<Conviction, string> = {
  faible: "Faible",
  moyenne: "Moyenne",
  forte: "Forte",
};
```

- [ ] **Step 2: Verify build**

Run:
```bash
npx next build 2>&1 | tail -10
```

Expected: build passes with no errors.

---

### Task 3: Create the perspective prompt builder

**Files:**
- Create: `src/lib/perspective-prompt.ts`

- [ ] **Step 1: Create the file**

Create `src/lib/perspective-prompt.ts`:

```typescript
import { db } from "@/lib/db";

export interface PerspectiveCompanyContext {
  name: string;
  ticker: string;
  sector: string;
}

export interface PerspectiveSignalInput {
  type: string;
  title: string;
  summary: string;
  justification: string;
  theme: string | null;
  date: string;
}

export interface PerspectiveSummaryInput {
  theme: string;
  score: number;
  summary: string;
}

/**
 * Fetch the 30 most recent signals and the latest DEU summaries per theme
 * for a given company. These are the inputs to the perspective prompt.
 */
export async function getPerspectiveInputs(companyId: string) {
  const signals = await db.signal.findMany({
    where: { companyId },
    orderBy: { analyzedAt: "desc" },
    take: 30,
    select: {
      type: true,
      title: true,
      summary: true,
      justification: true,
      theme: true,
      date: true,
    },
  });

  const allSummaries = await db.companySummary.findMany({
    where: { companyId },
    select: {
      theme: true,
      score: true,
      summary: true,
      filing: { select: { year: true } },
    },
    orderBy: { filing: { year: "desc" } },
  });

  // Deduplicate by theme, keeping the most recent filing's summary.
  const seen = new Set<string>();
  const summaries = allSummaries.filter((s) => {
    if (seen.has(s.theme)) return false;
    seen.add(s.theme);
    return true;
  });

  return {
    signals: signals as PerspectiveSignalInput[],
    summaries: summaries.map((s) => ({
      theme: s.theme,
      score: s.score,
      summary: s.summary,
    })) as PerspectiveSummaryInput[],
  };
}

/**
 * Compute the signal counts used both in the prompt context and in the
 * stored metrics.
 */
export function computeSignalMetrics(signals: PerspectiveSignalInput[]) {
  let bullish = 0;
  let bearish = 0;
  let neutral = 0;
  for (const s of signals) {
    if (s.type === "positive") bullish++;
    else if (s.type === "negative") bearish++;
    else neutral++;
  }
  return { signalsBullish: bullish, signalsBearish: bearish, signalsNeutral: neutral, totalSignals: signals.length };
}

/**
 * Build the user prompt sent to Claude to generate the perspective.
 */
export function buildPerspectivePrompt(
  company: PerspectiveCompanyContext,
  signals: PerspectiveSignalInput[],
  summaries: PerspectiveSummaryInput[]
): string {
  const metrics = computeSignalMetrics(signals);

  const scoresLine = summaries
    .filter((s) => s.theme !== "global")
    .map((s) => `${s.theme} ${s.score}/5`)
    .join(", ");

  const summariesBlock = summaries
    .map((s) => `### ${s.theme} (${s.score}/5)\n${s.summary}`)
    .join("\n\n");

  const signalsList = signals
    .map(
      (s, i) =>
        `${i + 1}. [${s.type.toUpperCase()}] ${s.title} — ${s.summary} (${s.justification})${s.theme ? ` [thème: ${s.theme}]` : ""}`
    )
    .join("\n");

  return `Tu es un analyste financier expert. Tu dois produire une perspective qualitative à court terme pour une entreprise en croisant ses signaux récents avec l'analyse de son Document d'Enregistrement Universel (DEU).

ENTREPRISE : ${company.name} (${company.ticker}) — Secteur : ${company.sector}
SCORES DEU : ${scoresLine || "non disponibles"}

RÉSUMÉS DEU PAR THÈME :
${summariesBlock || "Aucun résumé DEU disponible."}

SIGNAUX RÉCENTS (${metrics.totalSignals} signaux : ${metrics.signalsBullish} haussiers, ${metrics.signalsBearish} baissiers, ${metrics.signalsNeutral} neutres) :
${signalsList}

INSTRUCTIONS :
- Croise les signaux avec les constats du DEU. Ne résume pas simplement les signaux.
- Fais des liens explicites quand un signal confirme ou contredit un risque/opportunité du DEU.
- Si les signaux sont contradictoires ou peu nombreux (< 5), conviction = "faible".
- Si aucun signal clair ne domine, bias = "neutre" avec explication honnête.
- Reste factuel et nuancé. Pas de langage promotionnel ou alarmiste.

Retourne UNIQUEMENT un JSON valide (pas de markdown, pas de trailing commas) avec cette structure :
{
  "bias": "fortement_haussier" | "prudemment_haussier" | "neutre" | "prudemment_baissier" | "fortement_baissier",
  "conviction": "faible" | "moyenne" | "forte",
  "summary": "3-5 phrases croisant signaux et DEU",
  "risks": [{"title": "Titre court", "description": "1 phrase explicative"}],
  "catalysts": [{"title": "Titre court", "description": "1 phrase explicative"}]
}

JSON uniquement :`;
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
npx next build 2>&1 | tail -10
```

Expected: build passes with no errors.

---

### Task 4: Create the perspective API route

**Files:**
- Create: `src/app/api/perspective/[companyId]/route.ts`

- [ ] **Step 1: Create the directory and route file**

Create `src/app/api/perspective/[companyId]/route.ts`:

```typescript
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
          metrics: existing.metrics as PerspectiveResponse["perspective"] extends infer T
            ? T extends { metrics: infer M } ? M : never : never,
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
```

- [ ] **Step 2: Verify build**

Run:
```bash
npx next build 2>&1 | tail -20
```

Expected: build passes. The new route `/api/perspective/[companyId]` should appear as a Dynamic route.

**Note:** There is one tricky TypeScript line in the cached-perspective branch — the `metrics` type assertion. If the build fails on that line, simplify it to:

```typescript
metrics: existing.metrics as {
  signalsBullish: number;
  signalsBearish: number;
  signalsNeutral: number;
  riskScore: number | null;
  strategyScore: number | null;
  totalSignals: number;
},
```

---

### Task 5: Create the `PerspectivePanel` component

**Files:**
- Create: `src/components/company/perspective-panel.tsx`

- [ ] **Step 1: Create the file**

Create `src/components/company/perspective-panel.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { TrendingUp, AlertTriangle, Sparkles, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BIAS_CONFIG,
  CONVICTION_LABELS,
} from "@/lib/types";
import type { PerspectiveResponse, PerspectiveData } from "@/lib/types";

interface PerspectivePanelProps {
  companyId: string;
}

export function PerspectivePanel({ companyId }: PerspectivePanelProps) {
  const [data, setData] = useState<PerspectiveResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const abortController = new AbortController();

    fetch(`/api/perspective/${companyId}`, {
      signal: abortController.signal,
    })
      .then((r) => r.json())
      .then((json: PerspectiveResponse) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
        setData({ perspective: null, status: "error", message: "Impossible de charger la perspective" });
        setLoading(false);
      });

    return () => abortController.abort();
  }, [companyId]);

  if (loading) {
    return (
      <div>
        <div className="flex items-center gap-2.5 mb-6">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h2 className="text-2xl">Perspective</h2>
        </div>
        <div className="space-y-4">
          <div className="h-24 rounded-xl bg-muted/50 animate-pulse" />
          <div className="h-32 rounded-xl bg-muted/50 animate-pulse" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-28 rounded-xl bg-muted/50 animate-pulse" />
            <div className="h-28 rounded-xl bg-muted/50 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.status === "error") {
    return (
      <div>
        <div className="flex items-center gap-2.5 mb-6">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h2 className="text-2xl">Perspective</h2>
        </div>
        <p className="text-sm text-destructive py-4">
          {data?.message ?? "Impossible de charger la perspective"}
        </p>
      </div>
    );
  }

  if (data.status === "insufficient_data") {
    return (
      <div>
        <div className="flex items-center gap-2.5 mb-6">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h2 className="text-2xl">Perspective</h2>
        </div>
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">{data.message}</p>
        </div>
      </div>
    );
  }

  const p = data.perspective as PerspectiveData;
  const biasConfig = BIAS_CONFIG[p.bias];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h2 className="text-2xl">Perspective</h2>
        </div>
        <span className="text-xs text-muted-foreground">
          G&eacute;n&eacute;r&eacute;e le{" "}
          {new Date(p.generatedAt).toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      {/* Bloc 1: Verdict */}
      <div className={cn("rounded-xl border p-5 mb-6", biasConfig.bgColor)}>
        <div className="flex items-center justify-between mb-3">
          <span className={cn("text-xl font-bold", biasConfig.color)}>
            {biasConfig.arrow} {biasConfig.label}
          </span>
          <span className="text-sm text-muted-foreground">
            Conviction : <strong>{CONVICTION_LABELS[p.conviction]}</strong>
          </span>
        </div>

        {/* Bloc 2: Synthèse */}
        <p className="text-sm leading-relaxed">{p.summary}</p>
      </div>

      {/* Bloc 3 & 4: Risques et Catalyseurs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Risques clés */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h3 className="font-semibold text-sm">Risques cl&eacute;s</h3>
          </div>
          {p.risks.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucun risque majeur identifi&eacute;</p>
          ) : (
            <ul className="space-y-2">
              {p.risks.map((risk, i) => (
                <li key={i}>
                  <p className="text-sm font-medium">{risk.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {risk.description}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Catalyseurs potentiels */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-emerald-500" />
            <h3 className="font-semibold text-sm">Catalyseurs potentiels</h3>
          </div>
          {p.catalysts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucun catalyseur identifi&eacute;</p>
          ) : (
            <ul className="space-y-2">
              {p.catalysts.map((cat, i) => (
                <li key={i}>
                  <p className="text-sm font-medium">{cat.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {cat.description}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Métriques */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">M&eacute;triques</h3>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>
            Signaux :{" "}
            <strong className="text-emerald-500">{p.metrics.signalsBullish} haussiers</strong>
            {" / "}
            <strong className="text-red-500">{p.metrics.signalsBearish} baissiers</strong>
            {" / "}
            <strong>{p.metrics.signalsNeutral} neutres</strong>
          </span>
          {p.metrics.riskScore !== null && (
            <span>Risque DEU : <strong>{p.metrics.riskScore}/5</strong></span>
          )}
          {p.metrics.strategyScore !== null && (
            <span>Strat&eacute;gie DEU : <strong>{p.metrics.strategyScore}/5</strong></span>
          )}
          <span>Total : <strong>{p.metrics.totalSignals} signaux analys&eacute;s</strong></span>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground mt-4">
        Perspective qualitative bas&eacute;e sur l&apos;analyse crois&eacute;e DEU &times;
        actualit&eacute;s. Ne constitue pas un conseil d&apos;investissement.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
npx next build 2>&1 | tail -10
```

Expected: build passes with no errors.

---

### Task 6: Create the Perspective page and add navigation tab

**Files:**
- Create: `src/app/company/[id]/perspective/page.tsx`
- Modify: `src/app/company/[id]/layout.tsx`

- [ ] **Step 1: Create the Perspective page**

Create `src/app/company/[id]/perspective/page.tsx`:

```tsx
"use client";

import { useParams } from "next/navigation";
import { PerspectivePanel } from "@/components/company/perspective-panel";

export default function CompanyPerspectivePage() {
  const params = useParams();
  return <PerspectivePanel companyId={params.id as string} />;
}
```

- [ ] **Step 2: Add the Perspective tab to the layout navigation**

In `src/app/company/[id]/layout.tsx`, read the file first, then:

a. Add `TrendingUp` to the lucide-react import:
```ts
import { ArrowLeft, FileText, Zap, TrendingUp } from "lucide-react";
```

b. Find the `navItems` array and add a third entry. It currently looks like:
```tsx
const navItems = [
  { href: basePath, label: "Analyse", icon: FileText, active: isAnalysis },
  {
    href: `${basePath}/signals`,
    label: "Signaux",
    icon: Zap,
    active: isSignals,
  },
];
```

Update it to also handle the Perspective route:

First, add a new `isPerspective` const alongside `isAnalysis` and `isSignals`:
```tsx
const isPerspective = pathname === `${basePath}/perspective`;
```

Then add the third navItem:
```tsx
const navItems = [
  { href: basePath, label: "Analyse", icon: FileText, active: isAnalysis },
  {
    href: `${basePath}/signals`,
    label: "Signaux",
    icon: Zap,
    active: isSignals,
  },
  {
    href: `${basePath}/perspective`,
    label: "Perspective",
    icon: TrendingUp,
    active: isPerspective,
  },
];
```

- [ ] **Step 3: Verify build**

Run:
```bash
npx next build 2>&1 | tail -15
```

Expected: build passes. Both `/company/[id]/perspective` and `/api/perspective/[companyId]` should appear in the routes.

---

### Task 7: End-to-end manual verification

This is a manual smoke test. The dev server must be running and the database reachable.

- [ ] **Step 1: Navigate to a company Perspective tab**

Open `http://localhost:3000/company/<some-company-id>/perspective` in the browser. The company must have at least 3 signals in the database.

Verify:
- The skeleton loading state appears briefly (~5-8 seconds)
- The perspective renders with all 4 blocs: verdict (bias + conviction), synthesis paragraph, risks, catalysts
- The metrics section shows signal counts and DEU scores
- The disclaimer text appears at the bottom

- [ ] **Step 2: Verify cache (warm scenario)**

Reload the same page. This time:
- The perspective should appear instantly (< 300ms), with no loading delay
- The "Générée le" timestamp should be the same as before (data from cache, not re-generated)

- [ ] **Step 3: Verify insufficient data path**

Navigate to a company that has fewer than 3 signals (or find one via DB query). The page should display the "Pas assez de signaux..." message with a reference to the Signaux tab.

- [ ] **Step 4: Verify the navigation tab**

Confirm the "Perspective" tab appears in the company sub-navigation between "Signaux" and the TrendingUp icon, and that clicking it navigates correctly. Also confirm the active state highlights correctly.

- [ ] **Step 5: Test error path via curl**

```bash
curl -s http://localhost:3000/api/perspective/this-does-not-exist | head -c 500
```

Expected: `{"perspective":null,"status":"error","message":"Company not found"}`

---

## Self-Review

**Spec coverage:**
- Onglet "Perspective" in navigation → Task 6 step 2. ✓
- 4 blocs (verdict, synthèse, risques, catalyseurs) + métriques → Task 5. ✓
- Bias (5 levels) + conviction (3 levels) → Types in Task 2, validated in Task 4. ✓
- TTL 2h cache → Task 4, `CACHE_TTL_MS = 2 * 60 * 60 * 1000`. ✓
- Model switch (Haiku/Sonnet via env) → Task 4, `PERSPECTIVE_MODEL` constant. ✓
- No streaming → Task 4 uses `messages.create` (not `.stream`). ✓
- Signals limited to 30 most recent → Task 3, `take: 30`. ✓
- Minimum 3 signals → Task 4, `MIN_SIGNALS = 3`. ✓
- Upsert (one per company) → Task 4 step 7, `db.perspective.upsert`. ✓
- `companyId @unique` → Task 1 schema. ✓
- Error handling table → Task 4 covers all 5 cases from spec. ✓
- Hors scope items → none implemented. ✓

**Placeholder scan:** No TBD/TODO/fill-in. All code blocks contain real, complete code.

**Type consistency:**
- `Bias` type used in types.ts, route.ts, and component. Consistent.
- `Conviction` type used in types.ts, route.ts, and component. Consistent.
- `PerspectiveResponse` used in route.ts and component. Consistent.
- `BIAS_CONFIG` and `CONVICTION_LABELS` defined in types.ts, consumed by component. Consistent.
- `getPerspectiveInputs` and `buildPerspectivePrompt` signatures in prompt file match usage in route. Consistent.
- `computeSignalMetrics` defined in prompt file, used in both prompt builder and route. Consistent.
