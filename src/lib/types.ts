export type SectionCategory = "risk" | "strategy" | "governance" | "esg" | "financial" | "other";

export type Theme = "risk" | "strategy" | "global";

export const THEME_LABELS: Record<Theme, string> = {
  risk: "Risques",
  strategy: "Stratégie",
  global: "Global",
};

export const THEME_ORDER: Theme[] = ["risk", "strategy"];

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

export interface Signal {
  type: "positive" | "negative" | "neutral";
  title: string;
  summary: string;
  justification: string;
  theme: Theme | null;
  sourceUrl: string;
  date: string;
  relatedRisks: string[];
}

export interface SignalsResponse {
  signals: Signal[];
  companyName: string;
  analyzedAt: string;
  articleCount: number;
}
