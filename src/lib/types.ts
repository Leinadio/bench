export type SectionCategory = "risk" | "strategy" | "governance" | "esg" | "financial" | "other";

export interface SearchResult {
  id: string;
  heading: string;
  category: SectionCategory;
  content: string;
  snippet: string;
  companyName: string;
  companyTicker: string;
  filingYear: number;
  rank: number;
}

export interface CompanyWithFilings {
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
}
