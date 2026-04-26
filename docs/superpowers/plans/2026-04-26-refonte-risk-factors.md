# Refonte Complète — Facteurs de Risque Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer l'ensemble du système Signaux/Perspective par un affichage des facteurs de risque extraits directement depuis les sections des dépôts, stockés en base et affichés tels quels.

**Architecture:** Nouveau modèle `RiskFactor` en BDD alimenté par extraction des `Section` de catégorie "risk". API GET `/api/risk-factors/[companyId]` qui vérifie le cache en base puis extrait si vide. Composant `RiskFactorsPanel` remplace `PerspectivePanel`. Suppression complète du système signaux, actualités et scores.

**Tech Stack:** Next.js (App Router), Prisma ORM (PostgreSQL), TypeScript, Tailwind CSS, Lucide React

---

## Structure des fichiers

### À CRÉER
- `src/app/api/risk-factors/[companyId]/route.ts` — API extraction + cache des facteurs de risque
- `src/components/company/risk-factors-panel.tsx` — Composant d'affichage des facteurs de risque

### À MODIFIER
- `prisma/schema.prisma` — Ajout RiskFactor, suppression Signal/Perspective, nettoyage Company
- `src/lib/types.ts` — Nouveaux types RiskFactor, suppression Signal/Perspective/Bias/Conviction
- `src/app/company/[id]/layout.tsx` — Suppression onglet Signaux
- `src/app/company/[id]/perspective/page.tsx` — Utiliser RiskFactorsPanel
- `src/components/company/company-snapshot.tsx` — Supprimer ScoreBar
- `src/components/company/company-card.tsx` — Supprimer ScoreBar
- `src/components/layout/sidebar.tsx` — Supprimer lien Signaux

### À SUPPRIMER
- `src/app/company/[id]/signals/page.tsx`
- `src/app/signals/page.tsx`
- `src/app/api/signals/[companyId]/route.ts`
- `src/app/api/signals/[companyId]/stream/route.ts`
- `src/app/api/perspective/[companyId]/route.ts`
- `src/components/company/signals-panel.tsx`
- `src/components/company/signal-card.tsx`
- `src/components/company/score-badge.tsx`
- `src/components/company/score-bar.tsx`
- `src/lib/signals-prompt.ts`
- `src/lib/perspective-prompt.ts`
- `src/lib/news.ts`
- `src/lib/streaming-json.ts`

---

### Task 1: Mettre à jour le schéma Prisma

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Modifier le schéma**

Remplacer le contenu de `prisma/schema.prisma` par :

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

model Company {
  id      String   @id @default(cuid())
  name    String
  ticker  String   @unique
  index   String
  sector  String
  country String   @default("FR")
  filings     Filing[]
  summaries   CompanySummary[]
  riskFactors RiskFactor[]

  createdAt DateTime @default(now())
}

model Filing {
  id        String   @id @default(cuid())
  companyId String
  company   Company  @relation(fields: [companyId], references: [id])
  year      Int
  sourceUrl String
  status    String   @default("pending")
  parsedAt  DateTime?

  sections      Section[]
  financialData FinancialData[]
  summaries     CompanySummary[]
  riskFactors   RiskFactor[]

  createdAt DateTime @default(now())

  @@unique([companyId, year])
}

model Section {
  id       String @id @default(cuid())
  filingId String
  filing   Filing @relation(fields: [filingId], references: [id])

  heading    String
  depth      Int      @default(1)
  category   String   @default("other")
  content    String
  orderIndex Int      @default(0)

  searchVector Unsupported("tsvector")? @map("search_vector")

  createdAt DateTime @default(now())

  @@index([filingId])
  @@index([category])
  @@index([searchVector], type: Gin, map: "Section_search_vector_idx")
}

model FinancialData {
  id       String @id @default(cuid())
  filingId String
  filing   Filing @relation(fields: [filingId], references: [id])

  tagName     String
  value       String
  unit        String?
  periodStart DateTime?
  periodEnd   DateTime?

  @@index([filingId])
  @@index([tagName])
}

model CompanySummary {
  id        String  @id @default(cuid())
  filingId  String
  filing    Filing  @relation(fields: [filingId], references: [id])
  companyId String
  company   Company @relation(fields: [companyId], references: [id])

  theme              String
  score              Int
  scoreJustification String
  summary            String
  bulletPoints       Json

  createdAt DateTime @default(now())

  @@unique([filingId, theme])
  @@index([companyId])
}

model RiskFactor {
  id          String   @id @default(cuid())
  companyId   String
  company     Company  @relation(fields: [companyId], references: [id])
  filingId    String
  filing      Filing   @relation(fields: [filingId], references: [id])

  title       String
  description String
  impactLevel String?
  orderIndex  Int      @default(0)

  extractedAt DateTime @default(now())

  @@index([companyId])
  @@index([filingId])
}
```

- [ ] **Step 2: Générer la migration**

```bash
cd /Users/danieldupont/Developer/Projects/bench
npx prisma migrate dev --name add-risk-factors-remove-signals
```

Expected: Migration created and applied. Tables `Signal` et `Perspective` supprimées, table `RiskFactor` créée.

- [ ] **Step 3: Régénérer le client Prisma**

```bash
npx prisma generate
```

Expected: Client regénéré dans `src/generated/prisma/`.

---

### Task 2: Mettre à jour les types TypeScript

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Remplacer le contenu de types.ts**

```typescript
export type SectionCategory = "risk" | "strategy" | "governance" | "esg" | "financial" | "other";

export type Theme = "risk" | "strategy" | "global";

export const THEME_LABELS: Record<Theme, string> = {
  risk: "Risques",
  strategy: "Stratégie",
  global: "Global",
};

export interface BulletCategory {
  category: string;
  points: string[];
}

export interface CompanySummary {
  id: string;
  theme: Theme;
  score: number;
  scoreJustification: string;
  summary: string;
  bulletPoints: BulletCategory[];
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

export interface RiskFactor {
  id: string;
  title: string;
  description: string;
  impactLevel: string | null;
  orderIndex: number;
}

export interface RiskFactorsResponse {
  riskFactors: RiskFactor[];
  status: "cached" | "extracted" | "no_filing" | "no_sections" | "error";
  message?: string;
  filingYear?: number;
  extractedAt?: string;
}
```

Note: `CompanyWithSummaries` est simplifié (plus de `themeSummaries` car on n'affiche plus les scores par thème).

- [ ] **Step 2: Vérifier qu'il n'y a pas d'erreur TypeScript immédiate**

```bash
cd /Users/danieldupont/Developer/Projects/bench
npx tsc --noEmit 2>&1 | head -50
```

Expected: Des erreurs sur les fichiers qui vont être supprimés/modifiés dans les prochaines tâches. C'est attendu à ce stade.

---

### Task 3: Créer l'API /api/risk-factors/[companyId]

**Files:**
- Create: `src/app/api/risk-factors/[companyId]/route.ts`

- [ ] **Step 1: Créer le répertoire et le fichier**

```bash
mkdir -p /Users/danieldupont/Developer/Projects/bench/src/app/api/risk-factors/\[companyId\]
```

- [ ] **Step 2: Écrire le fichier route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { RiskFactorsResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function extractImpactLevel(text: string): string | null {
  const lower = text.toLowerCase();
  const match =
    lower.match(/impact\s*(?:potentiel|financier|estimé)?\s*[:\-]\s*([^\n,;.<]{1,30})/i) ||
    lower.match(/niveau\s*(?:d['']impact|de risque)?\s*[:\-]\s*([^\n,;.<]{1,30})/i) ||
    lower.match(/\bimpact\s*:\s*([^\n,;.<]{1,30})/i);
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
        { riskFactors: [], status: "error", message: "Company not found" } satisfies RiskFactorsResponse,
        { status: 404 }
      );
    }

    const filing = await db.filing.findFirst({
      where: { companyId },
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

    await db.riskFactor.createMany({ data: toCreate });

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
      extractedAt: stored[0]?.extractedAt.toISOString(),
    } satisfies RiskFactorsResponse);
  } catch (err) {
    console.error("[risk-factors] Fatal error:", err);
    return NextResponse.json(
      { riskFactors: [], status: "error", message: "Erreur lors de la récupération des facteurs de risque." } satisfies RiskFactorsResponse,
      { status: 500 }
    );
  }
}
```

---

### Task 4: Créer le composant RiskFactorsPanel

**Files:**
- Create: `src/components/company/risk-factors-panel.tsx`

- [ ] **Step 1: Écrire le composant**

```tsx
"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { RiskFactorsResponse, RiskFactor } from "@/lib/types";

interface RiskFactorsPanelProps {
  companyId: string;
}

export function RiskFactorsPanel({ companyId }: RiskFactorsPanelProps) {
  const [data, setData] = useState<RiskFactorsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/risk-factors/${companyId}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((json: RiskFactorsResponse) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
        setData({ riskFactors: [], status: "error", message: "Impossible de charger les facteurs de risque." });
        setLoading(false);
      });
    return () => controller.abort();
  }, [companyId]);

  if (loading) {
    return (
      <div>
        <Header />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-muted/50 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.status === "error") {
    return (
      <div>
        <Header />
        <p className="text-sm text-destructive py-4">
          {data?.message ?? "Impossible de charger les facteurs de risque."}
        </p>
      </div>
    );
  }

  if (data.status === "no_filing" || data.status === "no_sections") {
    return (
      <div>
        <Header />
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">{data.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <Header />
        {data.filingYear && (
          <span className="text-xs text-muted-foreground">DEU {data.filingYear}</span>
        )}
      </div>

      {data.riskFactors.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">Aucun facteur de risque identifié.</p>
      ) : (
        <ul className="space-y-4">
          {data.riskFactors.map((risk: RiskFactor) => (
            <li key={risk.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="font-semibold text-sm leading-snug">{risk.title}</h3>
                {risk.impactLevel && (
                  <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                    Impact : {risk.impactLevel}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {risk.description}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center gap-2.5 mb-6">
      <AlertTriangle className="w-5 h-5 text-primary" />
      <h2 className="text-2xl">Facteurs de risque</h2>
    </div>
  );
}
```

---

### Task 5: Mettre à jour la navigation du layout entreprise

**Files:**
- Modify: `src/app/company/[id]/layout.tsx`

- [ ] **Step 1: Supprimer l'onglet Signaux et nettoyer les imports**

Remplacer le contenu par :

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { CompanySnapshot } from "@/components/company/company-snapshot";
import { ArrowLeft, FileText, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CompanySummary } from "@/lib/types";

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

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const [company, setCompany] = useState<CompanyDetailData | null>(null);
  const [activeFilingIndex, setActiveFilingIndex] = useState(0);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/companies/${params.id}`)
      .then((r) => {
        if (!r.ok) { setNotFound(true); return null; }
        return r.json();
      })
      .then((data) => { if (data) setCompany(data); })
      .catch(() => setNotFound(true));
  }, [params.id]);

  if (notFound) {
    return (
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium transition-colors mb-6 group">
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          Entreprises
        </Link>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <p className="text-lg font-medium mb-2">Entreprise introuvable</p>
          <p className="text-sm text-muted-foreground">Cette entreprise n&apos;existe pas ou a &eacute;t&eacute; supprim&eacute;e.</p>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary/50 loading-dot" />
          <span className="w-2 h-2 rounded-full bg-primary/50 loading-dot" style={{ animationDelay: "0.2s" }} />
          <span className="w-2 h-2 rounded-full bg-primary/50 loading-dot" style={{ animationDelay: "0.4s" }} />
        </div>
      </div>
    );
  }

  const filing = company.filings[activeFilingIndex];
  const globalSummary = filing?.summaries.find((s) => s.theme === "global") || null;

  const basePath = `/company/${params.id}`;
  const navItems = [
    { href: basePath, label: "Analyse", icon: FileText, active: pathname === basePath },
    { href: `${basePath}/perspective`, label: "Perspective", icon: TrendingUp, active: pathname === `${basePath}/perspective` },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium transition-colors mb-6 group">
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
        Entreprises
      </Link>

      {company.filings.length > 1 && (
        <div className="flex gap-2 mb-6">
          {company.filings.map((f, i) => (
            <Button key={f.id} variant={i === activeFilingIndex ? "default" : "outline"} size="sm" onClick={() => setActiveFilingIndex(i)}>
              DEU {f.year}
            </Button>
          ))}
        </div>
      )}

      <CompanySnapshot
        name={company.name}
        ticker={company.ticker}
        sector={company.sector}
        globalSummary={globalSummary}
      />

      <nav className="mt-8 flex gap-1 border-b border-border">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              item.active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-6">{children}</div>
    </div>
  );
}
```

---

### Task 6: Mettre à jour la page Perspective

**Files:**
- Modify: `src/app/company/[id]/perspective/page.tsx`

- [ ] **Step 1: Remplacer le contenu de la page**

```tsx
"use client";

import { use } from "react";
import { RiskFactorsPanel } from "@/components/company/risk-factors-panel";

export default function PerspectivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <RiskFactorsPanel companyId={id} />;
}
```

---

### Task 7: Mettre à jour CompanySnapshot (supprimer ScoreBar)

**Files:**
- Modify: `src/components/company/company-snapshot.tsx`

- [ ] **Step 1: Réécrire le composant sans ScoreBar**

```tsx
import { Badge } from "@/components/ui/badge";
import type { CompanySummary } from "@/lib/types";

interface CompanySnapshotProps {
  name: string;
  ticker: string;
  sector: string;
  globalSummary: CompanySummary | null;
}

export function CompanySnapshot({ name, ticker, sector, globalSummary }: CompanySnapshotProps) {
  return (
    <div className="animate-fade-in-up">
      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-4xl">{name}</h1>
        <Badge variant="outline" className="font-mono text-xs">{ticker}</Badge>
      </div>
      <p className="text-muted-foreground text-base mb-6">{sector}</p>
      {globalSummary && (
        <div className="p-5 bg-card rounded-xl border border-border">
          <p className="text-base leading-relaxed">{globalSummary.summary}</p>
        </div>
      )}
    </div>
  );
}
```

---

### Task 8: Mettre à jour CompanyCard (supprimer ScoreBar)

**Files:**
- Modify: `src/components/company/company-card.tsx`

- [ ] **Step 1: Réécrire CompanyCard sans ScoreBar**

```tsx
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CompanyWithSummaries } from "@/lib/types";

export function CompanyCard({
  id,
  name,
  ticker,
  sector,
  filings,
  globalSummary,
}: CompanyWithSummaries) {
  return (
    <Link href={`/company/${id}`} className="group block">
      <Card className="h-full transition-all duration-200 hover:shadow-md hover:border-primary/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{name}</CardTitle>
            <Badge variant="outline" className="font-mono text-xs">{ticker}</Badge>
          </div>
          <CardDescription>{sector}</CardDescription>
        </CardHeader>
        <CardContent>
          {filings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun DEU index&eacute;</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {filings.length} DEU index&eacute;{filings.length > 1 ? "s" : ""}
            </p>
          )}
        </CardContent>
        {globalSummary && (
          <CardFooter>
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {globalSummary.summary}
            </p>
          </CardFooter>
        )}
      </Card>
    </Link>
  );
}
```

---

### Task 9: Mettre à jour la Sidebar (supprimer lien Signaux)

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Supprimer le lien Signaux de la navigation**

Remplacer uniquement `navItems` et l'import `Zap` :

Remplacer :
```typescript
import { Building2, ScanSearch, Zap, Moon, Sun } from "lucide-react";

const navItems = [
  { href: "/", label: "Entreprises", icon: Building2 },
  { href: "/signals", label: "Signaux", icon: Zap },
];
```

Par :
```typescript
import { Building2, ScanSearch, Moon, Sun } from "lucide-react";

const navItems = [
  { href: "/", label: "Entreprises", icon: Building2 },
];
```

---

### Task 10: Supprimer tous les fichiers obsolètes

**Files:**
- Delete: 13 fichiers listés ci-dessous

- [ ] **Step 1: Supprimer les pages signaux**

```bash
rm /Users/danieldupont/Developer/Projects/bench/src/app/company/\[id\]/signals/page.tsx
rmdir /Users/danieldupont/Developer/Projects/bench/src/app/company/\[id\]/signals 2>/dev/null || true
rm /Users/danieldupont/Developer/Projects/bench/src/app/signals/page.tsx
rmdir /Users/danieldupont/Developer/Projects/bench/src/app/signals 2>/dev/null || true
```

- [ ] **Step 2: Supprimer les routes API signaux et perspective**

```bash
rm /Users/danieldupont/Developer/Projects/bench/src/app/api/signals/\[companyId\]/stream/route.ts
rmdir /Users/danieldupont/Developer/Projects/bench/src/app/api/signals/\[companyId\]/stream 2>/dev/null || true
rm /Users/danieldupont/Developer/Projects/bench/src/app/api/signals/\[companyId\]/route.ts
rmdir "/Users/danieldupont/Developer/Projects/bench/src/app/api/signals/[companyId]" 2>/dev/null || true
rmdir /Users/danieldupont/Developer/Projects/bench/src/app/api/signals 2>/dev/null || true
rm /Users/danieldupont/Developer/Projects/bench/src/app/api/perspective/\[companyId\]/route.ts
rmdir "/Users/danieldupont/Developer/Projects/bench/src/app/api/perspective/[companyId]" 2>/dev/null || true
rmdir /Users/danieldupont/Developer/Projects/bench/src/app/api/perspective 2>/dev/null || true
```

- [ ] **Step 3: Supprimer les composants signaux et scores**

```bash
rm /Users/danieldupont/Developer/Projects/bench/src/components/company/signals-panel.tsx
rm /Users/danieldupont/Developer/Projects/bench/src/components/company/signal-card.tsx
rm /Users/danieldupont/Developer/Projects/bench/src/components/company/score-badge.tsx
rm /Users/danieldupont/Developer/Projects/bench/src/components/company/score-bar.tsx
```

- [ ] **Step 4: Supprimer les utilitaires signaux/perspective**

```bash
rm /Users/danieldupont/Developer/Projects/bench/src/lib/signals-prompt.ts
rm /Users/danieldupont/Developer/Projects/bench/src/lib/perspective-prompt.ts
rm /Users/danieldupont/Developer/Projects/bench/src/lib/news.ts
rm /Users/danieldupont/Developer/Projects/bench/src/lib/streaming-json.ts
```

- [ ] **Step 5: Supprimer l'ancien composant PerspectivePanel**

```bash
rm /Users/danieldupont/Developer/Projects/bench/src/components/company/perspective-panel.tsx
```

---

### Task 11: Vérification finale TypeScript + build

**Files:**
- No new files

- [ ] **Step 1: Vérifier les erreurs TypeScript**

```bash
cd /Users/danieldupont/Developer/Projects/bench
npx tsc --noEmit 2>&1
```

Expected: 0 erreurs. Si des erreurs subsistent sur `CompanyWithSummaries` (champ `themeSummaries` référencé ailleurs), vérifier `src/app/api/companies/route.ts` ou `[id]/route.ts` et retirer les références à `themeSummaries`.

- [ ] **Step 2: Vérifier que l'API companies ne renvoie plus themeSummaries inutilement**

```bash
grep -r "themeSummaries" /Users/danieldupont/Developer/Projects/bench/src --include="*.ts" --include="*.tsx"
```

Si des résultats apparaissent hors de `types.ts` (où il n'est plus), nettoyer manuellement.

- [ ] **Step 3: Build de vérification**

```bash
cd /Users/danieldupont/Developer/Projects/bench
npm run build 2>&1 | tail -30
```

Expected: Build réussi sans erreurs.

---

## Self-Review

**Spec coverage:**
- ✅ Pas de score affiché → ScoreBar/ScoreBadge supprimés, types Bias/Conviction supprimés
- ✅ Facteurs de risque affichés tels quels → RiskFactorsPanel lit le texte brut des sections
- ✅ Mise en forme titre + description + numéro d'impact → composant avec `<h3>` titre, `<p>` description, badge impact
- ✅ Suppression signaux et actualités → 13 fichiers supprimés, onglet/lien retiré de sidebar/layout
- ✅ Stockage en base → modèle RiskFactor + createMany dans la route API

**Placeholder scan:** Aucun TBD/TODO dans le code fourni.

**Type consistency:** `RiskFactor` défini dans Task 2, utilisé dans Task 3 et Task 4. `RiskFactorsResponse` cohérent entre les deux. `CompanyWithSummaries` sans `themeSummaries` dans Task 2, `CompanyCard` dans Task 8 ne l'utilise plus.
