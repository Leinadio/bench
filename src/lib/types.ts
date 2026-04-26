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
