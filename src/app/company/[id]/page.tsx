"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CompanySnapshot } from "@/components/company/company-snapshot";
import { ThemeCard } from "@/components/company/theme-card";
import { QAChat } from "@/components/company/qa-chat";
import { THEME_ORDER } from "@/lib/types";
import type { CompanySummary, Theme } from "@/lib/types";

interface CompanyDetailData {
  id: string;
  name: string;
  ticker: string;
  sector: string;
  filings: {
    id: string;
    year: number;
    summaries: CompanySummary[];
    sectionsByTheme: Record<
      string,
      { id: string; heading: string; content: string }[]
    >;
  }[];
}

export default function CompanyPage() {
  const params = useParams();
  const [company, setCompany] = useState<CompanyDetailData | null>(null);
  const [activeFilingIndex, setActiveFilingIndex] = useState(0);

  useEffect(() => {
    fetch(`/api/companies/${params.id}`)
      .then((r) => r.json())
      .then(setCompany);
  }, [params.id]);

  if (!company)
    return <p className="text-muted-foreground p-6">Chargement...</p>;

  const filing = company.filings[activeFilingIndex];
  if (!filing) return <p className="p-6">Aucun DEU disponible.</p>;

  const globalSummary =
    filing.summaries.find((s) => s.theme === "global") || null;
  const themeSummaries = filing.summaries.filter((s) => s.theme !== "global");

  return (
    <div className="max-w-4xl mx-auto">
      {company.filings.length > 1 && (
        <div className="flex gap-2 mb-4">
          {company.filings.map((f, i) => (
            <button
              key={f.id}
              onClick={() => setActiveFilingIndex(i)}
              className={`text-sm px-3 py-1 rounded ${
                i === activeFilingIndex
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              DEU {f.year}
            </button>
          ))}
        </div>
      )}

      <CompanySnapshot
        name={company.name}
        ticker={company.ticker}
        sector={company.sector}
        globalSummary={globalSummary}
        themeSummaries={themeSummaries}
      />

      <div className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold">Fiches th&eacute;matiques</h2>
        {THEME_ORDER.map((theme) => {
          const summary = themeSummaries.find((s) => s.theme === theme);
          if (!summary) return null;
          return (
            <ThemeCard
              key={theme}
              summary={summary}
              sourceSections={filing.sectionsByTheme[theme]}
            />
          );
        })}
      </div>

      <div className="mt-8 border-t pt-6">
        <QAChat filingId={filing.id} />
      </div>
    </div>
  );
}
