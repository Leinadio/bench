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
