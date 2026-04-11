# Signals Streaming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cron-based signal refresh with on-demand streaming. When a user opens a company's Signals page, the server streams cached signals instantly, then progressively streams freshly generated ones from Claude (via NDJSON).

**Architecture:** A single new API route at `GET /api/signals/[companyId]/stream` returns a `ReadableStream` of NDJSON events: `cached`, `signal`, `done`, `error`. A 30-minute cache TTL on `Company.lastSignalRefresh` skips Claude calls when results are still fresh. The route reuses the existing `fetchNews` helper, builds a prompt, parses Claude's streamed JSON output incrementally, persists each completed signal, and emits it to the client.

**Tech Stack:** Next.js 16 App Router (Node.js runtime), Anthropic SDK (`claude-haiku-4-5-20251001`) with `messages.stream`, Prisma 7 + adapter-pg, Google News RSS, NDJSON streaming via Web Streams API.

**Notes for the executor:**
- **Do not run `git add` or `git commit`** as part of any step. Commits are the user's call. Stop after each task and let the user decide.
- The codebase has no test framework configured. Tests are explicitly out of scope per the spec (`docs/superpowers/specs/2026-04-11-signals-streaming-design.md`). Verification = `npx next build` must pass after each task.
- Existing files referenced in this plan have been read and are stable. Paths and method signatures match their current state.

---

### Task 1: Add `lastSignalRefresh` field to the `Company` model

**Files:**
- Modify: `prisma/schema.prisma`
- Create (auto-generated): `prisma/migrations/<timestamp>_add_company_last_signal_refresh/migration.sql`

- [ ] **Step 1: Add the field to the schema**

In `prisma/schema.prisma`, locate the `Company` model and add the `lastSignalRefresh` field. The current model ends with `createdAt DateTime @default(now())`. After this line, add the new field so the model looks like:

```prisma
model Company {
  id      String   @id @default(cuid())
  name    String
  ticker  String   @unique
  index   String
  sector  String
  country String   @default("FR")
  filings   Filing[]
  summaries CompanySummary[]
  signals   Signal[]

  createdAt         DateTime  @default(now())
  lastSignalRefresh DateTime?
}
```

The field is **nullable** so existing companies don't need a backfill — `null` is interpreted as "never refreshed", which forces the first visit to trigger a refresh.

- [ ] **Step 2: Generate the migration**

Run:
```bash
npx prisma migrate dev --name add_company_last_signal_refresh
```

Expected: a new directory `prisma/migrations/<timestamp>_add_company_last_signal_refresh/` containing a `migration.sql` file with content like:
```sql
ALTER TABLE "Company" ADD COLUMN "lastSignalRefresh" TIMESTAMP(3);
```

The Prisma client is also regenerated automatically. The new field is now available as `company.lastSignalRefresh`.

- [ ] **Step 3: Verify build**

Run:
```bash
npx next build 2>&1 | tail -20
```

Expected: build passes with no TypeScript errors. The `lastSignalRefresh` field should appear in the regenerated Prisma client at `src/generated/prisma/`.

---

### Task 2: Create the streaming JSON parser

**Files:**
- Create: `src/lib/streaming-json.ts`

This is a small utility module that takes successive chunks of text (as Claude streams its output) and emits each complete top-level JSON object as soon as the closing brace is received. It correctly handles nested objects, strings (with escaped quotes), and tolerates surrounding noise like markdown fences, leading `[`, trailing `]`, and whitespace.

- [ ] **Step 1: Create the file**

Create `src/lib/streaming-json.ts`:

```typescript
/**
 * Incremental parser for a stream of JSON text containing one or more
 * top-level objects (typically a JSON array of objects from an LLM).
 *
 * Usage:
 *   const parser = createJsonObjectStreamParser();
 *   for (const chunk of textChunks) {
 *     const completed = parser.push(chunk);
 *     for (const obj of completed) {
 *       console.log("Got object:", obj);
 *     }
 *   }
 *
 * The parser:
 * - Tracks brace depth so it knows when an object is complete.
 * - Correctly skips braces appearing inside JSON strings.
 * - Handles escaped characters (e.g. `\"` inside a string).
 * - Ignores anything outside top-level objects (whitespace, commas, `[`, `]`,
 *   markdown code fences, etc.).
 * - Logs and skips objects that fail to parse, then continues.
 */
export interface JsonObjectStreamParser {
  push(chunk: string): unknown[];
}

export function createJsonObjectStreamParser(): JsonObjectStreamParser {
  let buffer = "";
  let position = 0;
  let depth = 0;
  let inString = false;
  let escape = false;
  let objectStartIdx = -1;

  return {
    push(chunk: string): unknown[] {
      buffer += chunk;
      const completed: unknown[] = [];

      while (position < buffer.length) {
        const ch = buffer[position];

        if (inString) {
          if (escape) {
            escape = false;
          } else if (ch === "\\") {
            escape = true;
          } else if (ch === '"') {
            inString = false;
          }
        } else {
          if (ch === '"') {
            inString = true;
          } else if (ch === "{") {
            if (depth === 0) {
              objectStartIdx = position;
            }
            depth++;
          } else if (ch === "}") {
            depth--;
            if (depth === 0 && objectStartIdx !== -1) {
              const objText = buffer.slice(objectStartIdx, position + 1);
              try {
                completed.push(JSON.parse(objText));
              } catch (err) {
                console.error(
                  "[streaming-json] Failed to parse object:",
                  objText.slice(0, 200),
                  err
                );
              }
              objectStartIdx = -1;
            }
          }
        }

        position++;
      }

      // If we're not in the middle of an object, drop the consumed prefix
      // to avoid unbounded buffer growth.
      if (depth === 0 && !inString) {
        buffer = buffer.slice(position);
        position = 0;
      }

      return completed;
    },
  };
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
npx next build 2>&1 | tail -10
```

Expected: build passes with no errors.

---

### Task 3: Create the prompt builder and scores helper

**Files:**
- Create: `src/lib/signals-prompt.ts`

This module owns the prompt template sent to Claude and the helper that fetches the company's DEU scores from the database.

- [ ] **Step 1: Create the file**

Create `src/lib/signals-prompt.ts`:

```typescript
import { db } from "@/lib/db";

export interface CompanyContext {
  name: string;
  ticker: string;
  sector: string;
}

export interface PromptArticle {
  title: string;
  url: string;
}

/**
 * Returns a short string like "risk 3/5, strategy 4/5" for use in the prompt.
 * Only the "risk" and "strategy" themes are included (other themes are not
 * relevant for signal cross-referencing).
 */
export async function getScoresContext(companyId: string): Promise<string> {
  const summaries = await db.companySummary.findMany({
    where: {
      companyId,
      theme: { in: ["risk", "strategy"] },
    },
    select: { theme: true, score: true },
  });

  return summaries.map((s) => `${s.theme} ${s.score}/5`).join(", ");
}

/**
 * Builds the user prompt sent to Claude Haiku to generate signals from
 * a list of fresh news articles. Mirrors the prompt used in the previous
 * Python pipeline so the LLM behavior stays consistent.
 */
export function buildSignalsPrompt(
  company: CompanyContext,
  articles: PromptArticle[],
  scoresContext: string
): string {
  const articlesList = articles
    .map((a, i) => `${i + 1}. ${a.title} | ${a.url}`)
    .join("\n");

  return `${company.name} (${company.ticker}, ${company.sector}). Scores DEU: ${scoresContext}.

Nouvelles actualités:
${articlesList}

Pour chaque actualité, génère un signal JSON. IMPORTANT: retourne un JSON array valide, sans trailing commas.
Champs: type ("positive"/"negative"/"neutral"), title, summary (1 phrase), justification (1 phrase: pourquoi haussier/baissier pour le cours), theme ("risk"/"strategy"/null), sourceUrl, date (JJ/MM/AAAA), relatedRisks (liste courte).

JSON array uniquement:`;
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
npx next build 2>&1 | tail -10
```

Expected: build passes with no errors.

---

### Task 4: Create the streaming API route

**Files:**
- Create: `src/app/api/signals/[companyId]/stream/route.ts`

This is the heart of the feature. It orchestrates: cache read, freshness check, RSS fetch, article filtering, Claude streaming, signal persistence, and stream emission.

- [ ] **Step 1: Create the directory and route file**

Create `src/app/api/signals/[companyId]/stream/route.ts`:

```typescript
import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { fetchNews } from "@/lib/news";
import { buildSignalsPrompt, getScoresContext } from "@/lib/signals-prompt";
import { createJsonObjectStreamParser } from "@/lib/streaming-json";
import type { Signal, Theme } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface RawSignal {
  type?: string;
  title?: string;
  summary?: string;
  justification?: string;
  theme?: string | null;
  sourceUrl?: string;
  date?: string;
  relatedRisks?: unknown;
}

interface DbSignalLike {
  type: string;
  title: string;
  summary: string;
  justification: string;
  theme: string | null;
  sourceUrl: string;
  date: string;
  relatedRisks: unknown;
}

function toSignalDTO(s: DbSignalLike): Signal {
  return {
    type: s.type as Signal["type"],
    title: s.title,
    summary: s.summary,
    justification: s.justification,
    theme: (s.theme as Theme | null) ?? null,
    sourceUrl: s.sourceUrl,
    date: s.date,
    relatedRisks: Array.isArray(s.relatedRisks) ? (s.relatedRisks as string[]) : [],
  };
}

function normalizeRawSignal(raw: RawSignal): {
  type: Signal["type"];
  title: string;
  summary: string;
  justification: string;
  theme: Theme | null;
  sourceUrl: string;
  date: string;
  relatedRisks: string[];
} {
  const validTypes: Signal["type"][] = ["positive", "negative", "neutral"];
  const type = validTypes.includes(raw.type as Signal["type"])
    ? (raw.type as Signal["type"])
    : "neutral";

  const validThemes: Theme[] = ["risk", "strategy"];
  const theme =
    raw.theme && validThemes.includes(raw.theme as Theme)
      ? (raw.theme as Theme)
      : null;

  const today = new Date().toLocaleDateString("fr-FR");

  return {
    type,
    title: (raw.title ?? "").slice(0, 500),
    summary: (raw.summary ?? "").slice(0, 1000),
    justification: (raw.justification ?? "").slice(0, 1000),
    theme,
    sourceUrl: raw.sourceUrl ?? "",
    date: raw.date && typeof raw.date === "string" ? raw.date : today,
    relatedRisks: Array.isArray(raw.relatedRisks)
      ? (raw.relatedRisks.filter((r) => typeof r === "string") as string[])
      : [],
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const send = (obj: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {
          closed = true;
        }
      };

      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed, ignore
        }
      };

      try {
        // 1. Find the company
        const company = await db.company.findUnique({
          where: { id: companyId },
        });
        if (!company) {
          send({ type: "error", message: "Company not found" });
          return close();
        }

        // 2. Send the cached signals first (instant feedback)
        const existing = await db.signal.findMany({
          where: { companyId },
          orderBy: { analyzedAt: "desc" },
        });
        send({ type: "cached", signals: existing.map(toSignalDTO) });

        // 3. Cache freshness check — skip refresh if last attempt was recent
        if (
          company.lastSignalRefresh &&
          Date.now() - company.lastSignalRefresh.getTime() < CACHE_TTL_MS
        ) {
          send({ type: "done" });
          return close();
        }

        // 4. Fetch news (non-fatal on failure: cache has been sent)
        let articles: { title: string; url: string; publishedAt: string }[] = [];
        try {
          articles = await fetchNews(company.name, company.ticker);
        } catch (err) {
          console.error("[signals-stream] News fetch failed:", err);
          await db.company.update({
            where: { id: companyId },
            data: { lastSignalRefresh: new Date() },
          });
          send({ type: "done" });
          return close();
        }

        // 5. Filter out articles already analyzed
        const existingUrls = new Set(existing.map((s) => s.sourceUrl));
        const newArticles = articles.filter((a) => !existingUrls.has(a.url));

        if (newArticles.length === 0) {
          await db.company.update({
            where: { id: companyId },
            data: { lastSignalRefresh: new Date() },
          });
          send({ type: "done" });
          return close();
        }

        // 6. Stream signals from Claude
        const scoresContext = await getScoresContext(companyId);
        const prompt = buildSignalsPrompt(
          {
            name: company.name,
            ticker: company.ticker,
            sector: company.sector,
          },
          newArticles.map((a) => ({ title: a.title, url: a.url })),
          scoresContext
        );

        const claudeStream = anthropic.messages.stream({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 4096,
          messages: [{ role: "user", content: prompt }],
        });

        const parser = createJsonObjectStreamParser();

        for await (const event of claudeStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const completedObjects = parser.push(event.delta.text);
            for (const raw of completedObjects) {
              const normalized = normalizeRawSignal(raw as RawSignal);
              try {
                const stored = await db.signal.create({
                  data: {
                    companyId,
                    type: normalized.type,
                    title: normalized.title,
                    summary: normalized.summary,
                    justification: normalized.justification,
                    theme: normalized.theme,
                    sourceUrl: normalized.sourceUrl,
                    date: normalized.date,
                    relatedRisks: normalized.relatedRisks,
                  },
                });
                send({ type: "signal", signal: toSignalDTO(stored) });
              } catch (err) {
                console.error("[signals-stream] DB insert failed:", err);
              }
            }
          }
        }

        // 7. Mark refresh complete
        await db.company.update({
          where: { id: companyId },
          data: { lastSignalRefresh: new Date() },
        });

        send({ type: "done" });
        close();
      } catch (err) {
        console.error("[signals-stream] Fatal error:", err);
        send({
          type: "error",
          message: err instanceof Error ? err.message : "Unknown error",
        });
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
    },
  });
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
npx next build 2>&1 | tail -20
```

Expected: build passes with no TypeScript errors. Among the routes listed, you should see `/api/signals/[companyId]/stream` as a Dynamic API route.

---

### Task 5: Update `SignalsPanel` to consume the NDJSON stream

**Files:**
- Modify: `src/components/company/signals-panel.tsx`

The current implementation calls `fetch(...).then(r => r.json())` which expects a single JSON response. Replace it with a streaming reader that processes NDJSON line by line.

- [ ] **Step 1: Replace the file content**

Overwrite `src/components/company/signals-panel.tsx` with:

```tsx
"use client";

import { useEffect, useState } from "react";
import { SignalCard } from "./signal-card";
import { Zap } from "lucide-react";
import type { Signal } from "@/lib/types";

interface SignalsPanelProps {
  companyId: string;
  companyName: string;
}

interface StreamEvent {
  type: "cached" | "signal" | "done" | "error";
  signals?: Signal[];
  signal?: Signal;
  message?: string;
}

export function SignalsPanel({ companyId }: SignalsPanelProps) {
  const [signals, setSignals] = useState<Signal[] | null>(null);
  const [loadingCache, setLoadingCache] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzedAt, setAnalyzedAt] = useState<Date | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    const consumeStream = async () => {
      try {
        const res = await fetch(`/api/signals/${companyId}/stream`, {
          signal: abortController.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          let newlineIdx;
          while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, newlineIdx).trim();
            buffer = buffer.slice(newlineIdx + 1);
            if (!line) continue;

            let event: StreamEvent;
            try {
              event = JSON.parse(line);
            } catch {
              continue;
            }

            if (event.type === "cached") {
              setSignals(event.signals ?? []);
              setLoadingCache(false);
              setRefreshing(true);
            } else if (event.type === "signal" && event.signal) {
              setSignals((prev) => {
                const next = [event.signal!, ...(prev ?? [])];
                return next;
              });
              setAnalyzedAt(new Date());
            } else if (event.type === "done") {
              setRefreshing(false);
            } else if (event.type === "error") {
              setError(event.message ?? "Erreur inconnue");
              setRefreshing(false);
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error("[SignalsPanel] Stream error:", err);
        setError("Impossible de charger les signaux");
        setLoadingCache(false);
        setRefreshing(false);
      }
    };

    consumeStream();
    return () => abortController.abort();
  }, [companyId]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <Zap className="w-5 h-5 text-primary" />
          <h2 className="text-2xl">Signaux r&eacute;cents</h2>
        </div>
        <div className="flex items-center gap-3">
          {refreshing && (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-2">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/50 loading-dot" />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-primary/50 loading-dot"
                  style={{ animationDelay: "0.2s" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-primary/50 loading-dot"
                  style={{ animationDelay: "0.4s" }}
                />
              </span>
              Recherche de nouveaux signaux...
            </span>
          )}
          {!refreshing && analyzedAt && (
            <span className="text-xs text-muted-foreground">
              Mis &agrave; jour{" "}
              {analyzedAt.toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
      </div>

      {loadingCache && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <div className="flex gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary/50 loading-dot" />
            <span
              className="w-2 h-2 rounded-full bg-primary/50 loading-dot"
              style={{ animationDelay: "0.2s" }}
            />
            <span
              className="w-2 h-2 rounded-full bg-primary/50 loading-dot"
              style={{ animationDelay: "0.4s" }}
            />
          </div>
          Chargement des signaux...
        </div>
      )}

      {!loadingCache && signals !== null && (
        <>
          {signals.length === 0 && !refreshing ? (
            <p className="text-sm text-muted-foreground py-4">
              Aucun signal disponible.
            </p>
          ) : (
            <div className="space-y-3">
              {signals.map((signal, i) => (
                <div
                  key={`${signal.sourceUrl}-${i}`}
                  className="animate-fade-in-up"
                  style={{ animationDelay: i < 5 ? `${i * 0.05}s` : "0s" }}
                >
                  <SignalCard signal={signal} companyId={companyId} />
                </div>
              ))}
            </div>
          )}
          {error && (
            <p className="text-xs text-destructive mt-3">{error}</p>
          )}
          <p className="text-xs text-muted-foreground mt-4">
            Analyse crois&eacute;e DEU &times; actualit&eacute;s. Ne constitue
            pas un conseil d&apos;investissement.
          </p>
        </>
      )}
    </div>
  );
}
```

Notes on the changes:
- The fetch URL changed from `/api/signals/${companyId}` to `/api/signals/${companyId}/stream`.
- The `loading` state was split into `loadingCache` (true while waiting for the first `cached` event) and `refreshing` (true between `cached` and `done` if a refresh is in progress).
- New signals coming via `signal` events are **prepended** to the list so the freshest item appears at the top.
- The animation delay is capped at the first 5 items to avoid awkward delays for long lists.
- The cleanup function aborts the fetch on unmount/remount so we don't leak readers.

- [ ] **Step 2: Verify build**

Run:
```bash
npx next build 2>&1 | tail -10
```

Expected: build passes with no errors.

---

### Task 6: Delete the obsolete Python signal refresh script

**Files:**
- Delete: `pipeline/refresh_signals.py`

The streaming API route now owns the refresh logic. The standalone Python script is no longer needed and would drift out of sync with the canonical implementation.

- [ ] **Step 1: Confirm no other Python file imports from `refresh_signals`**

Run:
```bash
grep -rn "refresh_signals" /Users/danieldupont/Developer/Projects/bench/pipeline/ 2>/dev/null
```

Expected: only the file itself appears (or no results). If any other file imports from it, stop and report — the deletion is safe only if nothing depends on it.

- [ ] **Step 2: Delete the file**

Run:
```bash
rm /Users/danieldupont/Developer/Projects/bench/pipeline/refresh_signals.py
```

Expected: no output. The file is gone.

- [ ] **Step 3: Verify build**

Run:
```bash
npx next build 2>&1 | tail -10
```

Expected: build passes. The Next.js build does not depend on the Python pipeline, so this should be unaffected, but we run it anyway to confirm nothing in TypeScript referenced the script's path.

---

### Task 7: End-to-end manual verification

This is a manual smoke test. The dev server must be running and the database reachable.

- [ ] **Step 1: Start the dev server**

Run:
```bash
npx next dev --port 3000
```

Wait for `Ready in <time>`.

- [ ] **Step 2: Open the Network tab in your browser DevTools, then navigate to a company's Signals page**

Navigate to `http://localhost:3000/company/<some-company-id>/signals` (replace `<some-company-id>` with a real ID from your DB).

In the Network tab, find the request to `/api/signals/<id>/stream`. Confirm:
- Response status: `200`
- Response header `Content-Type: application/x-ndjson`
- Response body (in the "EventStream" or raw view) contains lines of JSON, starting with `{"type":"cached", ...}`

- [ ] **Step 3: Confirm cached signals appear instantly**

Within the first ~300ms after navigation, the signals already in the DB should be visible on screen. The "Chargement des signaux..." spinner should disappear quickly.

- [ ] **Step 4: Confirm fresh signals stream in (cold cache scenario)**

If the company has `lastSignalRefresh = null` or older than 30 minutes:
- A "Recherche de nouveaux signaux..." indicator should appear next to the title
- New signal cards should appear **one by one** at the top of the list as Claude generates them
- After Claude finishes, the indicator disappears and is replaced by a "Mis à jour ..." timestamp

- [ ] **Step 5: Confirm the cache works (warm cache scenario)**

Reload the page. Within the 30-minute window:
- The signals should appear instantly
- No "Recherche de nouveaux signaux..." indicator (the server skipped the refresh)
- In the Network tab, the response should contain only `cached` and `done` events — no `signal` events

- [ ] **Step 6: Confirm the database was updated**

Check that `Company.lastSignalRefresh` was updated for the company you tested. Run a quick query (psql, Prisma Studio, or similar):
```sql
SELECT id, name, "lastSignalRefresh" FROM "Company" WHERE id = '<some-company-id>';
```
Expected: `lastSignalRefresh` is set to a recent timestamp.

Also verify new signal rows exist in the `Signal` table:
```sql
SELECT count(*) FROM "Signal" WHERE "companyId" = '<some-company-id>';
```
Expected: count is at least equal to what was visible on the page.

- [ ] **Step 7: Test the error path (optional)**

Visit `/company/this-id-does-not-exist/signals`. The page should display the cache loading state, then degrade gracefully (an error message in the panel). The server should return `200` with a stream containing `{"type":"error","message":"Company not found"}`.

---

## Self-Review (executed by the plan author)

**Spec coverage:**
- Architecture / data flow → Task 4 implements the full pipeline. ✓
- NDJSON format with 4 event types → Task 4 (server) + Task 5 (client). ✓
- `lastSignalRefresh` field → Task 1. ✓
- Streaming JSON parser → Task 2. ✓
- Prompt builder + scores helper → Task 3. ✓
- Frontend stream consumption → Task 5. ✓
- Delete Python script → Task 6. ✓
- Cache freshness check (30 min TTL) → Task 4 step 1, line `CACHE_TTL_MS`. ✓
- Error handling table → Task 4, mapped to `try/catch` blocks. ✓
- Existing GET route untouched → not modified, as spec specifies. ✓

**Placeholder scan:** No `TBD`/`TODO`/`fill in`/`similar to`. All code blocks contain real, complete code.

**Type consistency:**
- `Signal` shape used in route, parser output, and SignalsPanel matches `src/lib/types.ts:56-65`.
- `Theme` is `"risk" | "strategy" | "global"` per `types.ts:3`. The route normalizes to only `"risk" | "strategy" | null` because the prompt restricts Claude to those two themes (consistent with the existing Python script and the existing `Signal.theme` field).
- `fetchNews(name, ticker)` matches the existing signature in `src/lib/news.ts:7`.
- `db.signal.create` field names (`companyId`, `type`, `title`, `summary`, `justification`, `theme`, `sourceUrl`, `date`, `relatedRisks`) match the Prisma `Signal` model in `prisma/schema.prisma:96-113`.
- `db.companySummary.findMany` field names (`companyId`, `theme`, `score`) match the `CompanySummary` model.
- `Anthropic.messages.stream` event shape (`content_block_delta` with `delta.type === "text_delta"`) matches the SDK API.

No issues found.
