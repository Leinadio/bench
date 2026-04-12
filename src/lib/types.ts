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

export type Bias =
  | "fortement_haussier"
  | "prudemment_haussier"
  | "neutre"
  | "prudemment_baissier"
  | "fortement_baissier";

export type Conviction = "faible" | "moyenne" | "forte";

export interface PerspectiveData {
  bias: Bias;
  conviction: Conviction;
  summary: string;
  risks: { title: string; description: string }[];
  catalysts: { title: string; description: string }[];
  metrics: {
    signalsBullish: number;
    signalsBearish: number;
    signalsNeutral: number;
    riskScore: number | null;
    strategyScore: number | null;
    totalSignals: number;
  };
  generatedAt: string;
}

export interface PerspectiveResponse {
  perspective: PerspectiveData | null;
  status: "cached" | "generated" | "insufficient_data" | "error";
  message?: string;
}

export const BIAS_CONFIG: Record<
  Bias,
  { label: string; color: string; bgColor: string; arrow: string }
> = {
  fortement_haussier: {
    label: "Fortement haussier",
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
    arrow: "\u2197\u2197",
  },
  prudemment_haussier: {
    label: "Prudemment haussier",
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
    arrow: "\u2197",
  },
  neutre: {
    label: "Neutre",
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-50 dark:bg-gray-900/30",
    arrow: "\u2192",
  },
  prudemment_baissier: {
    label: "Prudemment baissier",
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950/30",
    arrow: "\u2198",
  },
  fortement_baissier: {
    label: "Fortement baissier",
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950/30",
    arrow: "\u2198\u2198",
  },
};

export const CONVICTION_LABELS: Record<Conviction, string> = {
  faible: "Faible",
  moyenne: "Moyenne",
  forte: "Forte",
};
