"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ThemeCard, THEME_CONFIG } from "@/components/company/theme-card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { THEME_ORDER, THEME_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { CompanySummary, Theme } from "@/lib/types";

interface CompanyDetailData {
  filings: {
    summaries: CompanySummary[];
    sectionsByTheme: Record<
      string,
      { id: string; heading: string; content: string }[]
    >;
  }[];
}

export default function CompanyAnalysisPage() {
  const params = useParams();
  const [data, setData] = useState<CompanyDetailData | null>(null);

  useEffect(() => {
    fetch(`/api/companies/${params.id}`)
      .then((r) => r.json())
      .then(setData);
  }, [params.id]);

  if (!data) return null;

  const filing = data.filings[0];
  if (!filing) return <p className="text-base">Aucun DEU disponible.</p>;

  const themeSummaries = filing.summaries.filter((s) => s.theme !== "global");
  const availableThemes = THEME_ORDER.filter((theme) =>
    themeSummaries.some((s) => s.theme === theme)
  );

  if (availableThemes.length === 0) return null;

  return (
    <div>
      <h2 className="text-2xl mb-5">Fiches th&eacute;matiques</h2>
      <Tabs defaultValue={availableThemes[0]}>
        <TabsList variant="line" className="mb-6 w-full">
          {availableThemes.map((theme) => {
            const config = THEME_CONFIG[theme];
            const Icon = config?.icon;
            return (
              <TabsTrigger key={theme} value={theme}>
                {Icon && (
                  <Icon className={cn("w-4 h-4", config?.accent)} />
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
  );
}
