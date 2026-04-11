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
    sourceUrl: (raw.sourceUrl ?? "").trim(),
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

  // Hoisted so the cancel() callback can abort it
  let claudeStream: ReturnType<typeof anthropic.messages.stream> | null = null;
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
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

        // 6. Stream signals from Claude (sanitized errors, abort on disconnect)
        try {
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

          claudeStream = anthropic.messages.stream({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 4096,
            messages: [{ role: "user", content: prompt }],
          });

          const parser = createJsonObjectStreamParser();

          for await (const event of claudeStream) {
            if (closed) break;
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const completedObjects = parser.push(event.delta.text);
              for (const raw of completedObjects) {
                if (closed) break;
                const normalized = normalizeRawSignal(raw as RawSignal);

                // Skip signals without a usable source URL — they break the
                // dedup filter on subsequent refreshes and render as broken cards.
                if (!normalized.sourceUrl) {
                  console.warn(
                    "[signals-stream] Skipping signal with empty sourceUrl:",
                    normalized.title
                  );
                  continue;
                }

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
        } catch (err) {
          console.error("[signals-stream] Claude streaming error:", err);
          send({ type: "error", message: "AI analysis failed" });
          return close();
        }

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
    cancel() {
      closed = true;
      if (claudeStream) {
        try {
          claudeStream.abort();
        } catch (err) {
          console.error("[signals-stream] Failed to abort Claude stream:", err);
        }
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
