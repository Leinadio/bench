import { db } from "@/lib/db";

export interface CompanyContext {
  name: string;
  ticker: string;
  sector: string;
}

export interface PromptArticle {
  title: string;
  url: string;
  publishedAt?: string; // DD/MM/YYYY, already formatted
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
    select: {
      theme: true,
      score: true,
      filing: { select: { year: true } },
    },
    orderBy: { filing: { year: "desc" } },
  });

  // Deduplicate by theme, keeping the most recent filing's score (first occurrence
  // in the desc-ordered list).
  const seen = new Set<string>();
  const latestPerTheme = summaries.filter((s) => {
    if (seen.has(s.theme)) return false;
    seen.add(s.theme);
    return true;
  });

  return latestPerTheme.map((s) => `${s.theme} ${s.score}/5`).join(", ");
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
    .map((a, i) => {
      const datePart = a.publishedAt ? `[${a.publishedAt}] ` : "";
      return `${i + 1}. ${datePart}${a.title} | ${a.url}`;
    })
    .join("\n");

  return `${company.name} (${company.ticker}, ${company.sector}). Scores DEU: ${scoresContext}.

Nouvelles actualités:
${articlesList}

Pour chaque actualité, génère un signal JSON. IMPORTANT: retourne un JSON array valide, sans trailing commas.
Champs: type ("positive"/"negative"/"neutral"), title, summary (1 phrase), justification (1 phrase: pourquoi haussier/baissier pour le cours), theme ("risk"/"strategy"/null), sourceUrl, date (format DD/MM/YYYY, reprends exactement la date de publication indiquée entre crochets pour l'actualité correspondante), relatedRisks (liste courte).

JSON array uniquement:`;
}
