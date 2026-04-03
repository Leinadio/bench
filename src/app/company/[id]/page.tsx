"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CompanySnapshot } from "@/components/company/company-snapshot";
import { ThemeCard, THEME_CONFIG } from "@/components/company/theme-card";
import { QAChat } from "@/components/company/qa-chat";
import { SignalsPanel } from "@/components/company/signals-panel";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { THEME_ORDER, THEME_LABELS } from "@/lib/types";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
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
  const [activeTheme, setActiveTheme] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/companies/${params.id}`)
      .then((r) => r.json())
      .then((data: CompanyDetailData) => {
        setCompany(data);
        const hash = window.location.hash;
        if (hash) {
          const themeMatch = hash.match(/^#theme-(\w+)$/);
          if (themeMatch) setActiveTheme(themeMatch[1]);
        }
      });
  }, [params.id]);

  if (!company)
    return (
      <div className="flex items-center justify-center h-64">
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
      </div>
    );

  const filing = company.filings[activeFilingIndex];
  if (!filing) return <p className="p-6 text-base">Aucun DEU disponible.</p>;

  const globalSummary =
    filing.summaries.find((s) => s.theme === "global") || null;
  const themeSummaries = filing.summaries.filter((s) => s.theme !== "global");

  const availableThemes = THEME_ORDER.filter((theme) =>
    themeSummaries.some((s) => s.theme === theme)
  );
  const defaultTheme = activeTheme && availableThemes.includes(activeTheme as Theme)
    ? activeTheme
    : availableThemes[0];

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium transition-colors mb-6 group"
      >
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
        Entreprises
      </Link>

      {company.filings.length > 1 && (
        <div className="flex gap-2 mb-6">
          {company.filings.map((f, i) => (
            <Button
              key={f.id}
              variant={i === activeFilingIndex ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveFilingIndex(i)}
            >
              DEU {f.year}
            </Button>
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

      {availableThemes.length > 0 && (
        <div className="mt-10">
          <h2 className="text-2xl mb-5">Fiches th&eacute;matiques</h2>
          <Tabs defaultValue={defaultTheme}>
            <TabsList variant="line" className="mb-6 w-full">
              {availableThemes.map((theme) => {
                const config = THEME_CONFIG[theme];
                const Icon = config?.icon;
                return (
                  <TabsTrigger key={theme} value={theme}>
                    {Icon && (
                      <Icon
                        className={cn("w-4 h-4", config?.accent)}
                      />
                    )}
                    {THEME_LABELS[theme as Theme]}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {availableThemes.map((theme) => {
              const summary = themeSummaries.find((s) => s.theme === theme);
              if (!summary) return null;
              return (
                <TabsContent key={theme} value={theme}>
                  <ThemeCard
                    summary={summary}
                    sourceSections={filing.sectionsByTheme[theme]}
                  />
                </TabsContent>
              );
            })}
          </Tabs>
        </div>
      )}

      {/* Signals */}
      <div className="mt-10 pt-8 border-t">
        <SignalsPanel companyId={company.id} companyName={company.name} />
      </div>

      <div className="mt-10 pt-8 border-t">
        <QAChat filingId={filing.id} />
      </div>
    </div>
  );
}
