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
