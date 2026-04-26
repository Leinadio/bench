# LVMH Normalized Risk Factor Schema — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat `RiskFactor` table with a normalized `RiskCategory + RiskFactor` schema that mirrors the LVMH URD 2025 structure (3 categories, 12 factors with criticality scores, verbatim description + risk management), extensible to other companies.

**Architecture:** Parse the local XHTML file directly with `fs.readFileSync` + regex (no external parser). Store data verbatim — no summarization. API returns data grouped by category. UI renders grouped cards with colored criticality badges.

**Tech Stack:** Prisma 7.6 / PostgreSQL, Next.js App Router (Node.js runtime), TypeScript, Tailwind CSS, lucide-react.

---

## XHTML Structure Reference (LVMH URD 2025)

The risk section (`_Toc225348211`) contains:
1. **Summary table** (lines 42517–42759): 4 columns — category name (rowspan), risk title, criticality score (1/2/3), section ref (1.1.1 etc.)
2. **Category headers** (lines 42768, 43036, 43272): `<p class="titre"><a id="_Toc...">1.N  Category name</a>`
3. **Factor headers** (e.g., line 42770): `<p class="titre">1.N.N  Risk title</p>` (no anchor)
4. **Detail tables**: `<div class="wrapper"><table ... class="textes">` with two columns: "Description du risque" | "Gestion du risque"
5. **End marker** (line 43415): `<a id="_Toc225348215">2. Politique d'assurance</a>`

Special case — section 1.3.1: combined title "Risques liés au change, à la liquidité et à l'évolution des taux d'intérêt" followed by two unnamed sub-headings + two tables. The parser collects all tables between consecutive numbered section titles.

---

## File Map

| Action   | File                                              | Responsibility                                  |
|----------|---------------------------------------------------|-------------------------------------------------|
| Modify   | `prisma/schema.prisma`                            | Add `RiskCategory`, update `RiskFactor`, add `localPath` to `Filing` |
| Create   | `prisma/migrations/20260426100000_.../migration.sql` | Schema migration SQL                          |
| Modify   | `src/lib/types.ts`                                | Add `RiskCategory`, update `RiskFactor`/`RiskFactorsResponse` |
| Create   | `src/lib/xhtml-risk-parser.ts`                    | Pure XHTML-to-data parser (no DB)               |
| Create   | `src/lib/__tests__/xhtml-risk-parser.test.ts`     | Unit tests for the parser                       |
| Create   | `scripts/seed-lvmh-local-path.ts`                 | One-time script to set `Filing.localPath`       |
| Modify   | `src/app/api/risk-factors/[companyId]/route.ts`   | Return grouped `{ categories }` from parser     |
| Modify   | `src/components/company/risk-factors-panel.tsx`   | Render categories + criticality badges          |

---

## Task 1: Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260426100000_normalize_risk_factors/migration.sql`

- [ ] **Step 1: Update `prisma/schema.prisma`**

Replace the entire `RiskFactor` model and add `RiskCategory`. Also add `localPath` to `Filing` and `riskCategories` relation to `Company` and `Filing`.

```prisma
model Filing {
  id        String   @id @default(cuid())
  companyId String
  company   Company  @relation(fields: [companyId], references: [id])
  year      Int
  sourceUrl String
  localPath String?
  status    String   @default("pending")
  parsedAt  DateTime?

  sections        Section[]
  financialData   FinancialData[]
  summaries       CompanySummary[]
  riskFactors     RiskFactor[]
  riskCategories  RiskCategory[]

  createdAt DateTime @default(now())

  @@unique([companyId, year])
}

model Company {
  id      String   @id @default(cuid())
  name    String
  ticker  String   @unique
  index   String
  sector  String
  country String   @default("FR")
  filings         Filing[]
  summaries       CompanySummary[]
  riskFactors     RiskFactor[]
  riskCategories  RiskCategory[]

  createdAt DateTime @default(now())
}

model RiskCategory {
  id          String   @id @default(cuid())
  companyId   String
  company     Company  @relation(fields: [companyId], references: [id])
  filingId    String
  filing      Filing   @relation(fields: [filingId], references: [id])

  name        String
  orderIndex  Int      @default(0)
  extractedAt DateTime @default(now())

  factors     RiskFactor[]

  @@index([companyId])
  @@index([filingId])
  @@unique([filingId, orderIndex])
}

model RiskFactor {
  id          String   @id @default(cuid())
  companyId   String
  company     Company  @relation(fields: [companyId], references: [id])
  filingId    String
  filing      Filing   @relation(fields: [filingId], references: [id])
  categoryId  String
  category    RiskCategory @relation(fields: [categoryId], references: [id])

  sectionRef        String?
  title             String
  description       String
  riskManagement    String
  criticalityScore  Int      @default(2)
  orderIndex        Int      @default(0)
  extractedAt       DateTime @default(now())

  @@index([companyId])
  @@index([filingId])
  @@index([categoryId])
  @@unique([filingId, orderIndex])
}
```

- [ ] **Step 2: Create migration SQL**

Create file `prisma/migrations/20260426100000_normalize_risk_factors/migration.sql`:

```sql
-- Drop old unique constraint and add localPath + RiskCategory
ALTER TABLE "Filing" ADD COLUMN "localPath" TEXT;

CREATE TABLE "RiskCategory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "filingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RiskCategory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RiskCategory_companyId_idx" ON "RiskCategory"("companyId");
CREATE INDEX "RiskCategory_filingId_idx" ON "RiskCategory"("filingId");
CREATE UNIQUE INDEX "RiskCategory_filingId_orderIndex_key" ON "RiskCategory"("filingId", "orderIndex");

ALTER TABLE "RiskCategory" ADD CONSTRAINT "RiskCategory_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RiskCategory" ADD CONSTRAINT "RiskCategory_filingId_fkey"
    FOREIGN KEY ("filingId") REFERENCES "Filing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop old RiskFactor table and recreate with new schema
DROP TABLE IF EXISTS "RiskFactor";

CREATE TABLE "RiskFactor" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "filingId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "sectionRef" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "riskManagement" TEXT NOT NULL,
    "criticalityScore" INTEGER NOT NULL DEFAULT 2,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RiskFactor_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RiskFactor_companyId_idx" ON "RiskFactor"("companyId");
CREATE INDEX "RiskFactor_filingId_idx" ON "RiskFactor"("filingId");
CREATE INDEX "RiskFactor_categoryId_idx" ON "RiskFactor"("categoryId");
CREATE UNIQUE INDEX "RiskFactor_filingId_orderIndex_key" ON "RiskFactor"("filingId", "orderIndex");

ALTER TABLE "RiskFactor" ADD CONSTRAINT "RiskFactor_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RiskFactor" ADD CONSTRAINT "RiskFactor_filingId_fkey"
    FOREIGN KEY ("filingId") REFERENCES "Filing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RiskFactor" ADD CONSTRAINT "RiskFactor_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "RiskCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 3: Apply migration**

```bash
cd /Users/danieldupont/Developer/Projects/bench
npx prisma migrate deploy
```

Expected: "1 migration applied."

- [ ] **Step 4: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: "Generated Prisma Client."

---

## Task 2: Types

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Update types**

Replace `RiskFactor` and `RiskFactorsResponse` in `src/lib/types.ts`. Add `RiskCategory`:

```typescript
export interface RiskFactor {
  id: string;
  sectionRef: string | null;
  title: string;
  description: string;
  riskManagement: string;
  criticalityScore: number;
  orderIndex: number;
}

export interface RiskCategory {
  id: string;
  name: string;
  orderIndex: number;
  factors: RiskFactor[];
}

export interface RiskFactorsResponse {
  categories: RiskCategory[];
  status: "cached" | "extracted" | "no_filing" | "no_local_path" | "no_sections" | "error";
  message?: string;
  filingYear?: number;
  extractedAt?: string;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep -v "\.next/"
```

Expected: no errors (some TS errors will appear from the API/component files not yet updated — those will be fixed in later tasks).

---

## Task 3: XHTML Parser

**Files:**
- Create: `src/lib/xhtml-risk-parser.ts`
- Create: `src/lib/__tests__/xhtml-risk-parser.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/xhtml-risk-parser.test.ts`:

```typescript
import { parseXhtmlRiskFactors } from "../xhtml-risk-parser";
import path from "path";
import fs from "fs";
import os from "os";

function makeFixture(content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xhtml-parser-"));
  const filePath = path.join(dir, "test.xhtml");
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

const MINIMAL_XHTML = `<?xml version="1.0"?>
<html>
<body>
<p><a id="_Toc000000001">1.    Facteurs de risques</a></p>
<div class="wrapper">
<table border="0">
  <tr>
    <td rowspan="2" style="padding-left: 0px">
      <p>Cat A</p>
    </td>
    <td><p>Risk One</p></td>
    <td style="background-color: rgb(220, 222, 227)"><p>1</p></td>
    <td><p>1.1.1</p></td>
  </tr>
  <tr>
    <td><p>Risk Two</p></td>
    <td style="background-color: rgb(220, 222, 227)"><p>2</p></td>
    <td><p>1.1.2</p></td>
  </tr>
</table>
</div>
<p><a id="_Toc000000002">1.1         Cat A</a></p>
<p class="titre">1.1.1       Risk One</p>
<div class="wrapper">
<table class="textes">
  <tr><td><p style="font-weight:700">Description du risque</p></td><td><p style="font-weight:700">Gestion du risque</p></td></tr>
  <tr>
    <td><p class="serif">Description of risk one.</p></td>
    <td><p class="puce serif"><span>●  </span>Management of risk one.</p></td>
  </tr>
</table>
</div>
<p class="titre">1.1.2       Risk Two</p>
<div class="wrapper">
<table class="textes">
  <tr><td><p style="font-weight:700">Description du risque</p></td><td><p style="font-weight:700">Gestion du risque</p></td></tr>
  <tr>
    <td><p class="serif">Description of risk two.</p></td>
    <td><p class="puce serif"><span>●  </span>Management of risk two.</p></td>
  </tr>
</table>
</div>
<p><a id="_Toc000000099">2.    Politique d'assurance</a></p>
</body>
</html>`;

describe("parseXhtmlRiskFactors", () => {
  it("returns one category with two factors", () => {
    const fp = makeFixture(MINIMAL_XHTML);
    const result = parseXhtmlRiskFactors(fp);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Cat A");
    expect(result[0].factors).toHaveLength(2);
  });

  it("extracts section refs and titles", () => {
    const fp = makeFixture(MINIMAL_XHTML);
    const [cat] = parseXhtmlRiskFactors(fp);
    expect(cat.factors[0].sectionRef).toBe("1.1.1");
    expect(cat.factors[0].title).toBe("Risk One");
    expect(cat.factors[1].sectionRef).toBe("1.1.2");
    expect(cat.factors[1].title).toBe("Risk Two");
  });

  it("reads criticality from summary table", () => {
    const fp = makeFixture(MINIMAL_XHTML);
    const [cat] = parseXhtmlRiskFactors(fp);
    expect(cat.factors[0].criticalityScore).toBe(1);
    expect(cat.factors[1].criticalityScore).toBe(2);
  });

  it("extracts description and risk management verbatim", () => {
    const fp = makeFixture(MINIMAL_XHTML);
    const [cat] = parseXhtmlRiskFactors(fp);
    expect(cat.factors[0].description).toContain("Description of risk one");
    expect(cat.factors[0].riskManagement).toContain("Management of risk one");
  });

  it("strips HTML tags from content", () => {
    const fp = makeFixture(MINIMAL_XHTML);
    const [cat] = parseXhtmlRiskFactors(fp);
    expect(cat.factors[0].description).not.toContain("<");
    expect(cat.factors[0].riskManagement).not.toContain("<");
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd /Users/danieldupont/Developer/Projects/bench
npx jest src/lib/__tests__/xhtml-risk-parser.test.ts --no-coverage 2>&1 | tail -20
```

Expected: FAIL — "Cannot find module '../xhtml-risk-parser'"

- [ ] **Step 3: Implement `src/lib/xhtml-risk-parser.ts`**

```typescript
import fs from "fs";

export interface ParsedRiskFactor {
  sectionRef: string;
  title: string;
  criticalityScore: number;
  description: string;
  riskManagement: string;
  orderIndex: number;
}

export interface ParsedCategory {
  name: string;
  orderIndex: number;
  factors: ParsedRiskFactor[];
}

function stripHtml(html: string): string {
  return html
    .replace(/<\/p>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<span[^>]*>\s*●[^<]*<\/span>/gi, "● ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;|&#8217;|&apos;/g, "’")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildCriticalityMap(summarySection: string): Map<string, number> {
  const map = new Map<string, number>();
  // Each row that has a criticality score: grey-background td then ref td
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(summarySection)) !== null) {
    const row = m[1];
    const critMatch = row.match(/background-color:\s*rgb\(220,\s*222,\s*227\)[^>]*>[\s\S]*?<p[^>]*>\s*(\d)\s*<\/p>/);
    const refMatch = row.match(/\b(\d+\.\d+\.\d+)\b/);
    if (critMatch && refMatch) {
      const ref = refMatch[1];
      if (!map.has(ref)) {
        map.set(ref, parseInt(critMatch[1], 10));
      }
    }
  }
  return map;
}

function extractTableContent(tableHtml: string): { description: string; riskManagement: string } {
  const rows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].slice(1); // skip header row
  const descParts: string[] = [];
  const mgmtParts: string[] = [];
  for (const row of rows) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
    if (cells[0]) {
      const text = stripHtml(cells[0][1]);
      if (text) descParts.push(text);
    }
    if (cells[1]) {
      const text = stripHtml(cells[1][1]);
      if (text) mgmtParts.push(text);
    }
  }
  return {
    description: descParts.join("\n\n").trim(),
    riskManagement: mgmtParts.join("\n\n").trim(),
  };
}

export function parseXhtmlRiskFactors(filePath: string): ParsedCategory[] {
  const content = fs.readFileSync(filePath, "utf-8");

  // Find anchor IDs marking section boundaries
  // Risk section starts at first category anchor, ends at the section after categories
  const anchorRe = /<a\s+id="(_Toc\d+)">([\s\S]*?)<\/a>/g;
  const anchors: { id: string; text: string; index: number }[] = [];
  let am: RegExpExecArray | null;
  while ((am = anchorRe.exec(content)) !== null) {
    anchors.push({ id: am[1], index: am.index, text: am[2] });
  }

  // Identify category-level anchors: text starts with a single digit + dot pattern "1.N "
  const categoryAnchors = anchors.filter((a) => /^\s*\d+\.\d+\s/.test(stripHtml(a.text)));
  if (categoryAnchors.length === 0) return [];

  // Find the summary section: from "Facteurs de risques" anchor to first category anchor
  const facteurAnchor = anchors.find((a) => /facteurs\s+de\s+risques/i.test(stripHtml(a.text)));
  const summaryStart = facteurAnchor ? facteurAnchor.index : 0;
  const summaryEnd = categoryAnchors[0].index;
  const summarySection = content.slice(summaryStart, summaryEnd);
  const criticalityMap = buildCriticalityMap(summarySection);

  // Find the end of the risk section: the anchor after the last category
  const lastCatIndex = categoryAnchors[categoryAnchors.length - 1].index;
  const endAnchor = anchors.find((a) => a.index > lastCatIndex && /^\s*\d+\.\s/.test(stripHtml(a.text)) && !/^\s*\d+\.\d+/.test(stripHtml(a.text)));
  const riskSectionEnd = endAnchor ? endAnchor.index : content.length;

  const categories: ParsedCategory[] = [];

  for (let ci = 0; ci < categoryAnchors.length; ci++) {
    const catAnchor = categoryAnchors[ci];
    const catEnd = ci + 1 < categoryAnchors.length ? categoryAnchors[ci + 1].index : riskSectionEnd;
    const catContent = content.slice(catAnchor.index, catEnd);
    const catName = stripHtml(catAnchor.text).replace(/^\d+\.\d+\s+/, "").trim();

    // Find numbered factor headers: <p class="titre">N.N.N  Title</p> (no <a> anchor)
    // Must match exactly 3-level numbering
    const factorTitleRe = /<p[^>]*class="titre"[^>]*>\s*(\d+\.\d+\.\d+)\s+([\s\S]*?)\s*<\/p>/g;
    const factorMatches: { sectionRef: string; title: string; index: number }[] = [];
    let fm: RegExpExecArray | null;
    while ((fm = factorTitleRe.exec(catContent)) !== null) {
      factorMatches.push({
        sectionRef: fm[1].trim(),
        title: stripHtml(fm[2]).trim(),
        index: fm.index,
      });
    }

    const factors: ParsedRiskFactor[] = [];

    for (let fi = 0; fi < factorMatches.length; fi++) {
      const factor = factorMatches[fi];
      const factorStart = factor.index;
      const factorEnd = fi + 1 < factorMatches.length ? factorMatches[fi + 1].index : catContent.length;
      const factorContent = catContent.slice(factorStart, factorEnd);

      // Collect all class="textes" tables in this range
      const tableRe = /<table[^>]*class="textes"[\s\S]*?<\/table>/g;
      let descAll = "";
      let mgmtAll = "";
      let tm: RegExpExecArray | null;
      while ((tm = tableRe.exec(factorContent)) !== null) {
        const { description, riskManagement } = extractTableContent(tm[0]);
        descAll = descAll ? `${descAll}\n\n${description}` : description;
        mgmtAll = mgmtAll ? `${mgmtAll}\n\n${riskManagement}` : riskManagement;
      }

      factors.push({
        sectionRef: factor.sectionRef,
        title: factor.title,
        criticalityScore: criticalityMap.get(factor.sectionRef) ?? 2,
        description: descAll,
        riskManagement: mgmtAll,
        orderIndex: fi,
      });
    }

    categories.push({ name: catName, orderIndex: ci, factors });
  }

  return categories;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest src/lib/__tests__/xhtml-risk-parser.test.ts --no-coverage 2>&1 | tail -20
```

Expected: PASS — 5 tests passing.

---

## Task 4: Admin Script — Seed `localPath` for LVMH

**Files:**
- Create: `scripts/seed-lvmh-local-path.ts`

- [ ] **Step 1: Create the seed script**

```typescript
// scripts/seed-lvmh-local-path.ts
import { db } from "../src/lib/db";

async function main() {
  const company = await db.company.findUnique({ where: { ticker: "MC.PA" } });
  if (!company) {
    console.error("Company MC.PA not found");
    process.exit(1);
  }

  const filing = await db.filing.findFirst({
    where: { companyId: company.id, status: { not: "pending" } },
    orderBy: { year: "desc" },
  });

  if (!filing) {
    console.error("No non-pending filing found for MC.PA");
    process.exit(1);
  }

  await db.filing.update({
    where: { id: filing.id },
    data: { localPath: "/Users/danieldupont/Developer/Projects/bench/rapports/deu_lvmh_2025.xhtml" },
  });

  console.log(`Updated filing ${filing.id} (year ${filing.year}) with localPath`);
  await db.$disconnect();
}

main();
```

- [ ] **Step 2: Run the script**

```bash
cd /Users/danieldupont/Developer/Projects/bench
npx tsx scripts/seed-lvmh-local-path.ts
```

Expected: "Updated filing <id> (year 2025) with localPath"

---

## Task 5: Updated API Route

**Files:**
- Modify: `src/app/api/risk-factors/[companyId]/route.ts`

- [ ] **Step 1: Rewrite the route**

```typescript
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

    // Check cache: if categories exist, return them
    const existingCategories = await db.riskCategory.findMany({
      where: { filingId: filing.id },
      orderBy: { orderIndex: "asc" },
      include: {
        factors: { orderBy: { orderIndex: "asc" } },
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
          description: f.description,
          riskManagement: f.riskManagement,
          criticalityScore: f.criticalityScore,
          orderIndex: f.orderIndex,
        })),
      }));
      return NextResponse.json({
        categories,
        status: "cached",
        filingYear: filing.year,
        extractedAt: existingCategories[0].extractedAt.toISOString(),
      } satisfies RiskFactorsResponse);
    }

    // No cache: check for local XHTML path
    if (!filing.localPath) {
      return NextResponse.json({
        categories: [],
        status: "no_local_path",
        message: "Aucun fichier local configuré pour ce dépôt.",
      } satisfies RiskFactorsResponse);
    }

    // Parse XHTML
    const parsed = parseXhtmlRiskFactors(filing.localPath);

    if (parsed.length === 0) {
      return NextResponse.json({
        categories: [],
        status: "no_sections",
        message: "Aucun facteur de risque trouvé dans le fichier.",
      } satisfies RiskFactorsResponse);
    }

    // Persist to DB
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

      const factors = await Promise.all(
        parsedCat.factors.map((f) =>
          db.riskFactor.create({
            data: {
              companyId,
              filingId: filing.id,
              categoryId: cat.id,
              sectionRef: f.sectionRef,
              title: f.title,
              description: f.description,
              riskManagement: f.riskManagement,
              criticalityScore: f.criticalityScore,
              orderIndex: globalFactorIndex++,
            },
          })
        )
      );

      createdCategories.push({
        id: cat.id,
        name: cat.name,
        orderIndex: cat.orderIndex,
        factors: factors.map((f) => ({
          id: f.id,
          sectionRef: f.sectionRef,
          title: f.title,
          description: f.description,
          riskManagement: f.riskManagement,
          criticalityScore: f.criticalityScore,
          orderIndex: f.orderIndex,
        })),
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
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep -v "\.next/" | grep "risk-factors"
```

Expected: no errors for this file.

---

## Task 6: Updated UI — RiskFactorsPanel

**Files:**
- Modify: `src/components/company/risk-factors-panel.tsx`

- [ ] **Step 1: Rewrite the panel**

```tsx
"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { RiskCategory, RiskFactorsResponse } from "@/lib/types";

const CRITICALITY_CONFIG: Record<number, { label: string; className: string }> = {
  1: { label: "Critique", className: "bg-red-100 text-red-800" },
  2: { label: "Important", className: "bg-orange-100 text-orange-800" },
  3: { label: "Modéré", className: "bg-yellow-100 text-yellow-700" },
};

interface Props {
  companyId: string;
}

export function RiskFactorsPanel({ companyId }: Props) {
  const [data, setData] = useState<{ categories: RiskCategory[]; filingYear?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/risk-factors/${companyId}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((res: RiskFactorsResponse) => {
        if (res.status === "error" || res.status === "no_filing" || res.status === "no_local_path" || res.status === "no_sections") {
          setError(res.message ?? "Données indisponibles.");
        } else {
          setData({ categories: res.categories, filingYear: res.filingYear });
        }
        setLoading(false);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError("Erreur lors du chargement.");
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [companyId]);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-muted-foreground">{error}</p>;
  }

  if (!data || data.categories.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun facteur de risque disponible.</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-amber-500" />
        <h2 className="text-2xl font-semibold">Facteurs de risque</h2>
        {data.filingYear && (
          <span className="text-sm text-muted-foreground ml-1">({data.filingYear})</span>
        )}
      </div>

      {data.categories.map((cat) => (
        <section key={cat.id}>
          <h3 className="text-lg font-semibold mb-4 text-muted-foreground uppercase tracking-wide text-sm">
            {cat.name}
          </h3>

          <div className="space-y-6">
            {cat.factors.map((factor) => {
              const crit = CRITICALITY_CONFIG[factor.criticalityScore] ?? CRITICALITY_CONFIG[2];
              return (
                <div key={factor.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="font-medium leading-snug">
                      {factor.sectionRef && (
                        <span className="text-muted-foreground mr-2 text-sm">{factor.sectionRef}</span>
                      )}
                      {factor.title}
                    </h4>
                    <span
                      className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${crit.className}`}
                    >
                      {crit.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 text-sm">
                    <div>
                      <p className="font-medium text-muted-foreground mb-1">Description du risque</p>
                      <p className="whitespace-pre-line leading-relaxed">{factor.description}</p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground mb-1">Gestion du risque</p>
                      <p className="whitespace-pre-line leading-relaxed">{factor.riskManagement}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep -v "\.next/"
```

Expected: no errors.

---

## Task 7: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -30
```

Expected: all tests pass including the new xhtml-risk-parser tests.

- [ ] **Step 2: Start dev server and verify UI**

```bash
npx next dev --turbopack 2>&1 &
```

Navigate to a company page → "Perspective" tab. Confirm:
- Risk factors load (not the "no_local_path" message)
- Three category sections visible
- Criticality badges colored correctly (red/orange/yellow)
- Description + Gestion side by side
- Content is verbatim French text from the XHTML (not summarized)

- [ ] **Step 3: Verify LVMH specifically**

Navigate to LVMH company page → Perspective tab. Confirm:
- 3 categories: "Risques liés aux opérations ou à l'activité", "Risques liés à l'environnement externe", "Risques financiers"
- 4 + 5 + 3 = 12 factors total (note: 1.3.1 is combined into one entry)
- Criticality 1 factors have red "Critique" badge
- Factor 1.1.1 title: "Risques liés aux produits ou à une communication en inadéquation avec l'image des Maisons"

---

## Self-Review

**Spec coverage:**
- ✅ Normalized schema with RiskCategory (catégories des risques) + RiskFactor (description du risque, niveau de criticité)
- ✅ Verbatim content — no summarization
- ✅ localPath on Filing → extensible to TotalEnergies etc.
- ✅ Criticality as numeric (1/2/3) with color labels (Critique/Important/Modéré)
- ✅ Gestion du risque column preserved

**Potential gaps:**
- The summary table lists two entries for section ref 1.3.1 (criticality 1 for "change", criticality 3 for "liquidité"). The parser only stores the first match → 1.3.1 gets criticality 1. This is acceptable since the XHTML groups them under one combined title.
- `no_sections` status is kept for backward compatibility but now means "XHTML returned no categories".
