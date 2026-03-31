# FilingLens V1 Refonte — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform FilingLens from a raw DEU section browser into a simplified intelligence dashboard with AI-generated themed summaries, visual scores, and collapsible detail cards.

**Architecture:** Enrich the existing Python pipeline with a new `summarize.py` step that generates per-theme summaries via Claude API. Store results in a new `CompanySummary` Prisma table. Redesign the frontend to show a snapshot (scores + summary) with expandable themed cards, replacing the current section browser. Keep Q&A.

**Tech Stack:** Prisma (schema + migration), Python (anthropic SDK), Next.js 15 (App Router), TypeScript, Tailwind, shadcn/ui (Card, Badge, Tabs, Collapsible)

---

## File Structure

### Files to CREATE
```
pipeline/summarize.py                          # Generate themed summaries via Claude
pipeline/tests/test_summarize.py               # Tests for summarize
src/components/company/score-badge.tsx          # Single score pastille (🔴🟡🟢)
src/components/company/score-bar.tsx            # Row of 5 score badges
src/components/company/theme-card.tsx           # Expandable themed card with bullets + source
src/components/company/company-snapshot.tsx     # Snapshot: scores + global summary
```

### Files to MODIFY
```
prisma/schema.prisma                           # Add CompanySummary model
pipeline/index.py                              # Add insert_summaries, delete_summaries
pipeline/run.py                                # Add step 5: summarize
src/lib/types.ts                               # Add summary types
src/app/api/companies/route.ts                 # Include global summary in list
src/app/api/companies/[id]/route.ts            # Include summaries + sections grouped by theme
src/app/page.tsx                               # Redesign dashboard with scores
src/app/company/[id]/page.tsx                  # Redesign: snapshot + fiches + Q&A
src/components/company/company-card.tsx         # Add score pastilles
src/components/layout/sidebar.tsx              # Remove search/compare links
```

### Files to DELETE
```
src/app/search/page.tsx
src/app/compare/page.tsx
src/app/api/search/route.ts
src/app/api/compare/route.ts
src/components/search/search-bar.tsx
src/components/search/search-results.tsx
src/components/compare/company-selector.tsx
src/components/compare/compare-view.tsx
src/components/company/section-nav.tsx
src/components/company/section-content.tsx
```

---

## Task 1: Add CompanySummary to Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add CompanySummary model to schema**

Add this model at the end of `prisma/schema.prisma`:

```prisma
model CompanySummary {
  id       String @id @default(cuid())
  filingId String
  filing   Filing @relation(fields: [filingId], references: [id])
  companyId String
  company   Company @relation(fields: [companyId], references: [id])

  theme             String   // risk, strategy, governance, esg, financial, global
  score             Int      // 1-5
  scoreJustification String
  summary           String
  bulletPoints      Json     // string[]

  createdAt DateTime @default(now())

  @@unique([filingId, theme])
  @@index([companyId])
}
```

Also add the reverse relations to existing models. In `Company`, add:
```prisma
  summaries CompanySummary[]
```

In `Filing`, add:
```prisma
  summaries CompanySummary[]
```

- [ ] **Step 2: Run migration**

```bash
cd ~/Developer/Projects/bench
npx prisma migrate dev --name add_company_summary
```

Expected: Migration created, CompanySummary table exists.

- [ ] **Step 3: Verify**

```bash
npx prisma generate
```

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: add CompanySummary model for AI-generated themed fiches"
```

---

## Task 2: Pipeline — Summarize Module

**Files:**
- Create: `pipeline/summarize.py`
- Create: `pipeline/tests/test_summarize.py`

- [ ] **Step 1: Write the failing test**

Create `pipeline/tests/test_summarize.py`:

```python
import json
from unittest.mock import patch, MagicMock
from pipeline.summarize import generate_theme_summary, generate_global_summary


SAMPLE_SECTIONS = [
    {"heading": "3.1 Risk Factors", "content": "The company faces climate risk and regulatory risk in EU markets."},
    {"heading": "3.2 Geopolitical Risk", "content": "Operations in unstable regions including Mozambique and Libya."},
    {"heading": "3.3 Cyber Risk", "content": "Threats to critical industrial infrastructure from cyber attacks."},
]

MOCK_THEME_RESPONSE = json.dumps({
    "score": 2,
    "scoreJustification": "High exposure to climate and geopolitical risks.",
    "summary": "The company faces significant risks across climate, geopolitical, and cyber dimensions.",
    "bulletPoints": [
        "Climate risk: exposure to EU carbon regulations",
        "Geopolitical risk: operations in unstable regions",
        "Cyber risk: threats to industrial infrastructure",
    ]
})

MOCK_GLOBAL_RESPONSE = json.dumps({
    "score": 3,
    "scoreJustification": "Solid strategy offset by significant risk exposure.",
    "summary": "A diversified energy company with strong fundamentals but elevated risk profile.",
    "bulletPoints": [
        "Elevated climate and geopolitical risk profile",
        "Strong transition strategy toward renewables",
        "Solid governance with experienced board",
    ]
})


def test_generate_theme_summary():
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text=MOCK_THEME_RESPONSE)]
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_response

    with patch("pipeline.summarize.get_client", return_value=mock_client):
        result = generate_theme_summary("risk", SAMPLE_SECTIONS, "TotalEnergies")

    assert result["theme"] == "risk"
    assert result["score"] == 2
    assert len(result["bulletPoints"]) == 3
    assert "climate" in result["bulletPoints"][0].lower()


def test_generate_theme_summary_clamps_score():
    bad_response = json.dumps({
        "score": 99,
        "scoreJustification": "test",
        "summary": "test",
        "bulletPoints": ["a"]
    })
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text=bad_response)]
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_response

    with patch("pipeline.summarize.get_client", return_value=mock_client):
        result = generate_theme_summary("risk", SAMPLE_SECTIONS, "TotalEnergies")

    assert result["score"] == 5  # clamped to max


def test_generate_global_summary():
    theme_summaries = [
        {"theme": "risk", "score": 2, "scoreJustification": "High risk.", "summary": "Risky.", "bulletPoints": ["risk1"]},
        {"theme": "strategy", "score": 4, "scoreJustification": "Good strategy.", "summary": "Strategic.", "bulletPoints": ["strat1"]},
    ]
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text=MOCK_GLOBAL_RESPONSE)]
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_response

    with patch("pipeline.summarize.get_client", return_value=mock_client):
        result = generate_global_summary(theme_summaries, "TotalEnergies")

    assert result["theme"] == "global"
    assert result["score"] == 3
    assert len(result["bulletPoints"]) == 3
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/Developer/Projects/bench
source pipeline/venv/bin/activate
PYTHONPATH=. python -m pytest pipeline/tests/test_summarize.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'pipeline.summarize'`

- [ ] **Step 3: Implement summarize.py**

Create `pipeline/summarize.py`:

```python
import json
from anthropic import Anthropic
from pipeline.config import ANTHROPIC_API_KEY

VALID_THEMES = {"risk", "strategy", "governance", "esg", "financial"}

THEME_LABELS = {
    "risk": "Facteurs de risque",
    "strategy": "Stratégie et objectifs",
    "governance": "Gouvernance",
    "esg": "ESG et développement durable",
    "financial": "Données financières",
}

THEME_PROMPT = """Tu es un analyste financier expert. Tu simplifies un Document d'Enregistrement Universel (DEU) pour un investisseur qui n'a pas le temps de lire 700 pages.

Voici les sections du DEU de {company_name} classifiées dans le thème "{theme_label}".

SECTIONS:
{sections_text}

Génère un JSON avec cette structure exacte :
{{
  "score": <int 1-5, où 1=critique/très faible et 5=excellent/très solide>,
  "scoreJustification": "<1-2 phrases expliquant le score>",
  "summary": "<résumé du thème en 3 phrases max, clair et accessible>",
  "bulletPoints": ["<point clé 1>", "<point clé 2>", ..., "<point clé N>"]
}}

Règles :
- 5 à 10 bullet points maximum
- Chaque bullet point fait 1 phrase, claire et concrète
- Le résumé doit être compréhensible par quelqu'un qui ne connaît pas l'entreprise
- Le score doit être honnête : 2/5 est un résultat valide
- Écris en français

Retourne UNIQUEMENT le JSON, rien d'autre."""

GLOBAL_PROMPT = """Tu es un analyste financier expert. Voici les fiches thématiques simplifiées du DEU de {company_name} :

{themes_text}

Génère un JSON résumant l'ensemble :
{{
  "score": <int 1-5, score global de l'entreprise>,
  "scoreJustification": "<1-2 phrases justifiant le score global>",
  "summary": "<résumé global en 3 phrases : forces, faiblesses, perspective>",
  "bulletPoints": ["<les 3 points les plus importants à retenir>"]
}}

Règles :
- Exactement 3 bullet points (les plus importants)
- Le résumé doit permettre de comprendre l'entreprise en 10 secondes
- Écris en français

Retourne UNIQUEMENT le JSON, rien d'autre."""


def get_client() -> Anthropic:
    return Anthropic(api_key=ANTHROPIC_API_KEY)


def generate_theme_summary(theme: str, sections: list[dict], company_name: str) -> dict:
    """Generate a simplified summary for one theme of a DEU."""
    client = get_client()

    sections_text = "\n\n---\n\n".join(
        f"### {s['heading']}\n{s['content'][:2000]}"
        for s in sections
    )

    theme_label = THEME_LABELS.get(theme, theme)
    prompt = THEME_PROMPT.format(
        company_name=company_name,
        theme_label=theme_label,
        sections_text=sections_text[:50000],  # stay within context limits
    )

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text.strip()
    data = json.loads(raw)

    # Clamp score to 1-5
    data["score"] = max(1, min(5, int(data.get("score", 3))))
    data["theme"] = theme

    return data


def generate_global_summary(theme_summaries: list[dict], company_name: str) -> dict:
    """Generate a global summary from all theme summaries."""
    client = get_client()

    themes_text = "\n\n".join(
        f"**{THEME_LABELS.get(s['theme'], s['theme'])}** (score: {s['score']}/5)\n"
        f"Résumé : {s['summary']}\n"
        f"Points clés : {', '.join(s['bulletPoints'][:5])}"
        for s in theme_summaries
    )

    prompt = GLOBAL_PROMPT.format(
        company_name=company_name,
        themes_text=themes_text,
    )

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text.strip()
    data = json.loads(raw)
    data["score"] = max(1, min(5, int(data.get("score", 3))))
    data["theme"] = "global"

    return data


def generate_all_summaries(sections_by_theme: dict[str, list[dict]], company_name: str) -> list[dict]:
    """Generate summaries for all themes + global.

    Args:
        sections_by_theme: dict mapping theme -> list of section dicts
        company_name: name of the company

    Returns:
        list of 6 summary dicts (5 themes + 1 global)
    """
    summaries = []

    for theme in VALID_THEMES:
        theme_sections = sections_by_theme.get(theme, [])
        if not theme_sections:
            continue
        print(f"    Generating {theme} summary ({len(theme_sections)} sections)...")
        summary = generate_theme_summary(theme, theme_sections, company_name)
        summaries.append(summary)

    if summaries:
        print(f"    Generating global summary...")
        global_summary = generate_global_summary(summaries, company_name)
        summaries.append(global_summary)

    return summaries
```

- [ ] **Step 4: Run test to verify it passes**

```bash
PYTHONPATH=. python -m pytest pipeline/tests/test_summarize.py -v
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add pipeline/summarize.py pipeline/tests/test_summarize.py
git commit -m "feat: summarize module - generate themed fiches and scores via Claude"
```

---

## Task 3: Update Pipeline Index + Run

**Files:**
- Modify: `pipeline/index.py`
- Modify: `pipeline/run.py`

- [ ] **Step 1: Add summary DB functions to index.py**

Add these functions at the end of `pipeline/index.py`:

```python
def delete_summaries(cursor, filing_id: str):
    cursor.execute('DELETE FROM "CompanySummary" WHERE "filingId" = %s', (filing_id,))


def insert_summaries(cursor, filing_id: str, company_id: str, summaries: list[dict]):
    for summary in summaries:
        summary_id = str(uuid.uuid4()).replace("-", "")[:25]
        cursor.execute(
            'INSERT INTO "CompanySummary" (id, "filingId", "companyId", theme, score, "scoreJustification", summary, "bulletPoints", "createdAt") VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)',
            (
                summary_id,
                filing_id,
                company_id,
                summary["theme"],
                summary["score"],
                summary["scoreJustification"],
                summary["summary"],
                json.dumps(summary["bulletPoints"], ensure_ascii=False),
                datetime.now(),
            ),
        )
```

Also add `import json` at the top of `pipeline/index.py` if not already present.

- [ ] **Step 2: Update run.py to add summarize step**

Replace `pipeline/run.py` with:

```python
"""
FilingLens Pipeline Orchestrator.

Usage:
    python -m pipeline.run --company "TotalEnergies" --ticker TTE --sector Energy --year 2024 \
        --url "https://totalenergies.com/system/files/documents/totalenergies_document-enregistrement-universel-2024_2025_fr.zip"
"""
import argparse
import sys

from pipeline.config import DOWNLOADS_DIR
from pipeline.download import download_and_extract
from pipeline.parse import parse_xhtml_sections
from pipeline.classify import classify_sections
from pipeline.summarize import generate_all_summaries
from pipeline.index import (
    get_connection,
    get_or_create_company,
    get_or_create_filing,
    insert_sections,
    insert_summaries,
    delete_summaries,
    mark_filing_done,
)


def run_pipeline(company_name: str, ticker: str, sector: str, year: int, url: str, index: str = "CAC40", country: str = "FR"):
    print(f"[1/6] Downloading {url}...")
    output_dir = DOWNLOADS_DIR / ticker / str(year)
    output_dir.mkdir(parents=True, exist_ok=True)

    xhtml_path = download_and_extract(url, str(output_dir))
    if not xhtml_path:
        print("ERROR: No XHTML found in ZIP.")
        sys.exit(1)
    print(f"  -> Extracted: {xhtml_path}")

    print("[2/6] Parsing XHTML sections...")
    with open(xhtml_path, "r", encoding="utf-8") as f:
        xhtml_content = f.read()
    sections = parse_xhtml_sections(xhtml_content)
    print(f"  -> Found {len(sections)} sections")

    print("[3/6] Classifying sections with Claude...")
    sections = classify_sections(sections)
    categories = {}
    for s in sections:
        categories[s["category"]] = categories.get(s["category"], 0) + 1
    print(f"  -> Categories: {categories}")

    print("[4/6] Indexing sections in PostgreSQL...")
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            company_id = get_or_create_company(cur, company_name, ticker, index, sector, country)
            filing_id = get_or_create_filing(cur, company_id, year, url)
            cur.execute('DELETE FROM "Section" WHERE "filingId" = %s', (filing_id,))
            insert_sections(cur, filing_id, sections)
        conn.commit()
    finally:
        conn.close()
    print(f"  -> Indexed {len(sections)} sections")

    print("[5/6] Generating AI summaries...")
    sections_by_theme = {}
    for s in sections:
        cat = s["category"]
        if cat not in sections_by_theme:
            sections_by_theme[cat] = []
        sections_by_theme[cat].append(s)

    summaries = generate_all_summaries(sections_by_theme, company_name)
    print(f"  -> Generated {len(summaries)} summaries")
    for s in summaries:
        print(f"    {s['theme']}: {s['score']}/5")

    print("[6/6] Saving summaries and finalizing...")
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            delete_summaries(cur, filing_id)
            insert_summaries(cur, filing_id, company_id, summaries)
            mark_filing_done(cur, filing_id)
        conn.commit()
    finally:
        conn.close()

    print(f"Done! {len(sections)} sections + {len(summaries)} summaries for {company_name} ({year})")
    return sections, summaries


def main():
    parser = argparse.ArgumentParser(description="FilingLens Pipeline")
    parser.add_argument("--company", required=True, help="Company name")
    parser.add_argument("--ticker", required=True, help="Stock ticker")
    parser.add_argument("--sector", default="Unknown", help="Sector")
    parser.add_argument("--year", type=int, required=True, help="Filing year")
    parser.add_argument("--url", required=True, help="ESEF ZIP URL")
    parser.add_argument("--index", default="CAC40", help="Stock index")
    parser.add_argument("--country", default="FR", help="Country code")
    args = parser.parse_args()

    run_pipeline(
        company_name=args.company,
        ticker=args.ticker,
        sector=args.sector,
        year=args.year,
        url=args.url,
        index=args.index,
        country=args.country,
    )


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Run all pipeline tests**

```bash
PYTHONPATH=. python -m pytest pipeline/tests/ -v
```

Expected: All 14 tests pass (11 existing + 3 new).

- [ ] **Step 4: Commit**

```bash
git add pipeline/index.py pipeline/run.py
git commit -m "feat: integrate summarize step into pipeline - 6-step orchestrator"
```

---

## Task 4: Update TypeScript Types + API Routes

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/app/api/companies/route.ts`
- Modify: `src/app/api/companies/[id]/route.ts`
- Delete: `src/app/api/search/route.ts`
- Delete: `src/app/api/compare/route.ts`

- [ ] **Step 1: Update types.ts**

Replace `src/lib/types.ts`:

```typescript
export type SectionCategory = "risk" | "strategy" | "governance" | "esg" | "financial" | "other";

export type Theme = "risk" | "strategy" | "governance" | "esg" | "financial" | "global";

export const THEME_LABELS: Record<Theme, string> = {
  risk: "Risques",
  strategy: "Stratégie",
  governance: "Gouvernance",
  esg: "ESG",
  financial: "Finance",
  global: "Global",
};

export const THEME_ORDER: Theme[] = ["risk", "strategy", "governance", "esg", "financial"];

export interface CompanySummary {
  id: string;
  theme: Theme;
  score: number;
  scoreJustification: string;
  summary: string;
  bulletPoints: string[];
}

export interface CompanyWithSummaries {
  id: string;
  name: string;
  ticker: string;
  index: string;
  sector: string;
  filings: {
    id: string;
    year: number;
    status: string;
    sectionCount: number;
  }[];
  globalSummary: CompanySummary | null;
  themeSummaries: CompanySummary[];
}

export interface CompanyDetail {
  id: string;
  name: string;
  ticker: string;
  sector: string;
  filings: {
    id: string;
    year: number;
    summaries: CompanySummary[];
    sectionsByTheme: Record<string, { id: string; heading: string; content: string }[]>;
  }[];
}
```

- [ ] **Step 2: Update companies list API**

Replace `src/app/api/companies/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const companies = await db.company.findMany({
    include: {
      filings: {
        select: {
          id: true,
          year: true,
          status: true,
          _count: { select: { sections: true } },
        },
        orderBy: { year: "desc" },
      },
      summaries: {
        select: {
          id: true,
          theme: true,
          score: true,
          scoreJustification: true,
          summary: true,
          bulletPoints: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const result = companies.map((c) => ({
    id: c.id,
    name: c.name,
    ticker: c.ticker,
    index: c.index,
    sector: c.sector,
    filings: c.filings.map((f) => ({
      id: f.id,
      year: f.year,
      status: f.status,
      sectionCount: f._count.sections,
    })),
    globalSummary: c.summaries.find((s) => s.theme === "global") || null,
    themeSummaries: c.summaries.filter((s) => s.theme !== "global"),
  }));

  return NextResponse.json(result);
}
```

- [ ] **Step 3: Update company detail API**

Replace `src/app/api/companies/[id]/route.ts`:

```typescript
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
          summaries: {
            select: {
              id: true,
              theme: true,
              score: true,
              scoreJustification: true,
              summary: true,
              bulletPoints: true,
            },
          },
          sections: {
            select: {
              id: true,
              heading: true,
              category: true,
              content: true,
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

  const result = {
    id: company.id,
    name: company.name,
    ticker: company.ticker,
    sector: company.sector,
    filings: company.filings.map((f) => {
      const sectionsByTheme: Record<string, { id: string; heading: string; content: string }[]> = {};
      for (const s of f.sections) {
        if (!sectionsByTheme[s.category]) sectionsByTheme[s.category] = [];
        sectionsByTheme[s.category].push({ id: s.id, heading: s.heading, content: s.content });
      }
      return {
        id: f.id,
        year: f.year,
        summaries: f.summaries,
        sectionsByTheme,
      };
    }),
  };

  return NextResponse.json(result);
}
```

- [ ] **Step 4: Delete search and compare API routes**

```bash
cd ~/Developer/Projects/bench
rm src/app/api/search/route.ts
rmdir src/app/api/search
rm src/app/api/compare/route.ts
rmdir src/app/api/compare
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/app/api/
git commit -m "feat: API returns summaries + scores, remove search/compare endpoints"
```

---

## Task 5: Add shadcn Collapsible + New UI Components

**Files:**
- Create: `src/components/company/score-badge.tsx`
- Create: `src/components/company/score-bar.tsx`
- Create: `src/components/company/theme-card.tsx`
- Create: `src/components/company/company-snapshot.tsx`

- [ ] **Step 1: Install shadcn collapsible**

```bash
cd ~/Developer/Projects/bench
npx shadcn@latest add collapsible
```

- [ ] **Step 2: Create score-badge component**

Create `src/components/company/score-badge.tsx`:

```tsx
import { cn } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number;
  label: string;
  size?: "sm" | "md";
}

function scoreColor(score: number): string {
  if (score <= 2) return "bg-red-500";
  if (score === 3) return "bg-yellow-500";
  return "bg-green-500";
}

function scoreTextColor(score: number): string {
  if (score <= 2) return "text-red-700";
  if (score === 3) return "text-yellow-700";
  return "text-green-700";
}

export function ScoreBadge({ score, label, size = "md" }: ScoreBadgeProps) {
  return (
    <div className={cn("flex flex-col items-center gap-1", size === "sm" && "scale-90")}>
      <div
        className={cn(
          "rounded-full flex items-center justify-center text-white font-bold",
          scoreColor(score),
          size === "md" ? "w-10 h-10 text-sm" : "w-8 h-8 text-xs"
        )}
      >
        {score}/5
      </div>
      <span className={cn("text-xs font-medium", scoreTextColor(score))}>{label}</span>
    </div>
  );
}
```

- [ ] **Step 3: Create score-bar component**

Create `src/components/company/score-bar.tsx`:

```tsx
import { ScoreBadge } from "./score-badge";
import { THEME_LABELS, THEME_ORDER } from "@/lib/types";
import type { CompanySummary } from "@/lib/types";

interface ScoreBarProps {
  summaries: CompanySummary[];
  size?: "sm" | "md";
}

export function ScoreBar({ summaries, size = "md" }: ScoreBarProps) {
  return (
    <div className="flex gap-4">
      {THEME_ORDER.map((theme) => {
        const summary = summaries.find((s) => s.theme === theme);
        if (!summary) return null;
        return (
          <ScoreBadge
            key={theme}
            score={summary.score}
            label={THEME_LABELS[theme]}
            size={size}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Create theme-card component**

Create `src/components/company/theme-card.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScoreBadge } from "./score-badge";
import { THEME_LABELS } from "@/lib/types";
import type { CompanySummary, Theme } from "@/lib/types";

interface ThemeCardProps {
  summary: CompanySummary;
  sourceSections?: { id: string; heading: string; content: string }[];
}

export function ThemeCard({ summary, sourceSections }: ThemeCardProps) {
  const [open, setOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="transition-colors hover:border-primary/30">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ScoreBadge score={summary.score} label="" size="sm" />
                <div>
                  <CardTitle className="text-base">
                    {THEME_LABELS[summary.theme as Theme] || summary.theme}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {summary.summary.split(".")[0]}.
                  </p>
                </div>
              </div>
              <span className="text-muted-foreground text-sm">
                {open ? "▲" : "▼"}
              </span>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="mb-3">
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Score : {summary.score}/5 — {summary.scoreJustification}
              </p>
            </div>

            <p className="text-sm mb-4">{summary.summary}</p>

            <h4 className="text-sm font-semibold mb-2">Points clés</h4>
            <ul className="space-y-1.5 mb-4">
              {summary.bulletPoints.map((point, i) => (
                <li key={i} className="text-sm flex gap-2">
                  <span className="text-muted-foreground shrink-0">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>

            {sourceSections && sourceSections.length > 0 && (
              <Collapsible open={sourceOpen} onOpenChange={setSourceOpen}>
                <CollapsibleTrigger className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  {sourceOpen ? "▲ Masquer" : "▼ Voir"} les sections sources du DEU ({sourceSections.length})
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-3 space-y-3 border-t pt-3">
                    {sourceSections.map((section) => (
                      <div key={section.id}>
                        <h5 className="text-xs font-semibold text-muted-foreground">
                          {section.heading}
                        </h5>
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-1 max-h-40 overflow-auto">
                          {section.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
```

- [ ] **Step 5: Create company-snapshot component**

Create `src/components/company/company-snapshot.tsx`:

```tsx
import { ScoreBar } from "./score-bar";
import type { CompanySummary } from "@/lib/types";

interface CompanySnapshotProps {
  name: string;
  ticker: string;
  sector: string;
  globalSummary: CompanySummary | null;
  themeSummaries: CompanySummary[];
}

export function CompanySnapshot({
  name,
  ticker,
  sector,
  globalSummary,
  themeSummaries,
}: CompanySnapshotProps) {
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-2xl font-bold">{name}</h1>
        <span className="text-lg text-muted-foreground">{ticker}</span>
      </div>
      <p className="text-muted-foreground mb-4">{sector}</p>

      <ScoreBar summaries={themeSummaries} />

      {globalSummary && (
        <div className="mt-4 p-4 bg-muted/30 rounded-lg">
          <p className="text-sm">{globalSummary.summary}</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/
git commit -m "feat: new UI components - score badges, score bar, theme cards, snapshot"
```

---

## Task 6: Redesign Dashboard Page

**Files:**
- Modify: `src/components/company/company-card.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Update company-card with scores**

Replace `src/components/company/company-card.tsx`:

```tsx
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreBar } from "./score-bar";
import type { CompanyWithSummaries } from "@/lib/types";

export function CompanyCard({ id, name, ticker, sector, filings, globalSummary, themeSummaries }: CompanyWithSummaries) {
  return (
    <Link href={`/company/${id}`}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{name}</CardTitle>
            <Badge variant="secondary">{ticker}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{sector}</p>
        </CardHeader>
        <CardContent>
          {themeSummaries.length > 0 ? (
            <>
              <ScoreBar summaries={themeSummaries} size="sm" />
              {globalSummary && (
                <p className="text-xs text-muted-foreground mt-3 line-clamp-2">
                  {globalSummary.summary}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              {filings.length > 0 ? "Fiches en cours de génération..." : "Aucun DEU indexé"}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 2: Update dashboard page**

Replace `src/app/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { CompanyCard } from "@/components/company/company-card";
import type { CompanyWithSummaries } from "@/lib/types";

export default function DashboardPage() {
  const [companies, setCompanies] = useState<CompanyWithSummaries[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/companies")
      .then((r) => r.json())
      .then((data) => {
        setCompanies(data);
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">FilingLens</h1>
      <p className="text-muted-foreground mb-6">
        Les DEU du CAC 40, simplifiés par l'IA.
      </p>

      {loading ? (
        <p className="text-muted-foreground">Chargement...</p>
      ) : companies.length === 0 ? (
        <p className="text-muted-foreground">
          Aucune entreprise. Lancez le pipeline pour indexer un DEU.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((company) => (
            <CompanyCard key={company.id} {...company} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Simplify sidebar**

Replace `src/components/layout/sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r bg-muted/30 p-4 flex flex-col gap-2">
      <Link href="/" className="font-bold text-lg px-3 py-2 mb-4">
        FilingLens
      </Link>
      <nav className="flex flex-col gap-1">
        <Link
          href="/"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
            pathname === "/" && "bg-accent font-medium"
          )}
        >
          Entreprises
        </Link>
      </nav>
    </aside>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/
git commit -m "feat: redesign dashboard with score pastilles and AI summaries"
```

---

## Task 7: Redesign Company Detail Page

**Files:**
- Modify: `src/app/company/[id]/page.tsx`
- Delete: `src/components/company/section-nav.tsx`
- Delete: `src/components/company/section-content.tsx`

- [ ] **Step 1: Delete old components**

```bash
cd ~/Developer/Projects/bench
rm src/components/company/section-nav.tsx
rm src/components/company/section-content.tsx
```

- [ ] **Step 2: Rewrite company detail page**

Replace `src/app/company/[id]/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CompanySnapshot } from "@/components/company/company-snapshot";
import { ThemeCard } from "@/components/company/theme-card";
import { QAChat } from "@/components/company/qa-chat";
import { THEME_ORDER } from "@/lib/types";
import type { CompanySummary, Theme } from "@/lib/types";

interface CompanyDetailData {
  id: string;
  name: string;
  ticker: string;
  sector: string;
  filings: {
    id: string;
    year: number;
    summaries: CompanySummary[];
    sectionsByTheme: Record<string, { id: string; heading: string; content: string }[]>;
  }[];
}

export default function CompanyPage() {
  const params = useParams();
  const [company, setCompany] = useState<CompanyDetailData | null>(null);
  const [activeFilingIndex, setActiveFilingIndex] = useState(0);

  useEffect(() => {
    fetch(`/api/companies/${params.id}`)
      .then((r) => r.json())
      .then(setCompany);
  }, [params.id]);

  if (!company) return <p className="text-muted-foreground p-6">Chargement...</p>;

  const filing = company.filings[activeFilingIndex];
  if (!filing) return <p className="p-6">Aucun DEU disponible.</p>;

  const globalSummary = filing.summaries.find((s) => s.theme === "global") || null;
  const themeSummaries = filing.summaries.filter((s) => s.theme !== "global");

  return (
    <div className="max-w-4xl mx-auto">
      {/* Year selector */}
      {company.filings.length > 1 && (
        <div className="flex gap-2 mb-4">
          {company.filings.map((f, i) => (
            <button
              key={f.id}
              onClick={() => setActiveFilingIndex(i)}
              className={`text-sm px-3 py-1 rounded ${
                i === activeFilingIndex
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              DEU {f.year}
            </button>
          ))}
        </div>
      )}

      {/* Snapshot */}
      <CompanySnapshot
        name={company.name}
        ticker={company.ticker}
        sector={company.sector}
        globalSummary={globalSummary}
        themeSummaries={themeSummaries}
      />

      {/* Theme cards */}
      <div className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold">Fiches thématiques</h2>
        {THEME_ORDER.map((theme) => {
          const summary = themeSummaries.find((s) => s.theme === theme);
          if (!summary) return null;
          return (
            <ThemeCard
              key={theme}
              summary={summary}
              sourceSections={filing.sectionsByTheme[theme]}
            />
          );
        })}
      </div>

      {/* Q&A */}
      <div className="mt-8 border-t pt-6">
        <QAChat filingId={filing.id} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/
git commit -m "feat: redesign company page - snapshot, themed cards, source DEU"
```

---

## Task 8: Cleanup V2 Pages

**Files:**
- Delete: `src/app/search/page.tsx`, `src/app/compare/page.tsx`
- Delete: `src/components/search/`, `src/components/compare/`

- [ ] **Step 1: Delete search and compare pages and components**

```bash
cd ~/Developer/Projects/bench
rm -rf src/app/search
rm -rf src/app/compare
rm -rf src/components/search
rm -rf src/components/compare
```

- [ ] **Step 2: Verify build**

```bash
cd ~/Developer/Projects/bench
npm run build 2>&1 | tail -20
```

Expected: Build passes with no errors. If there are import errors from deleted files, fix them.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove search and compare pages (moved to V2)"
```

---

## Task 9: End-to-End Test

- [ ] **Step 1: Re-run pipeline on TotalEnergies with summaries**

```bash
cd ~/Developer/Projects/bench
source pipeline/venv/bin/activate
PYTHONPATH=. python -m pipeline.run \
    --company "TotalEnergies" \
    --ticker TTE \
    --sector Energy \
    --year 2024 \
    --url "https://totalenergies.com/system/files/documents/totalenergies_document-enregistrement-universel-2024_2025_fr.zip"
```

Expected: 6 steps complete, 6 summaries generated (5 themes + 1 global), all with scores.

- [ ] **Step 2: Start app and verify**

```bash
npm run dev
```

Verify at http://localhost:3000:
1. **Dashboard**: TotalEnergies card shows 5 score pastilles + summary excerpt
2. **Company page**: Snapshot with scores + 3-phrase summary
3. **Theme cards**: 5 expandable cards with bullet points
4. **Source DEU**: Clicking "Voir les sections sources" shows raw DEU text
5. **Q&A**: Ask "Quels sont les principaux risques climatiques ?" — gets a sourced answer

- [ ] **Step 3: Run all tests**

```bash
PYTHONPATH=. python -m pytest pipeline/tests/ -v
```

Expected: 14 tests pass.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: FilingLens V1 complete - simplified DEU with AI scores and themed fiches"
```
