"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { RiskFactorsResponse, RiskFactor } from "@/lib/types";

interface RiskFactorsPanelProps {
  companyId: string;
}

export function RiskFactorsPanel({ companyId }: RiskFactorsPanelProps) {
  const [data, setData] = useState<RiskFactorsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/risk-factors/${companyId}`, { signal: controller.signal })
      .then((r) => r.json() as Promise<RiskFactorsResponse>)
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
        setData({ riskFactors: [], status: "error", message: "Impossible de charger les facteurs de risque." });
        setLoading(false);
      });
    return () => controller.abort();
  }, [companyId]);

  if (loading) {
    return (
      <div>
        <Header />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-muted/50 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.status === "error") {
    return (
      <div>
        <Header />
        <p className="text-sm text-destructive py-4">
          {data?.message ?? "Impossible de charger les facteurs de risque."}
        </p>
      </div>
    );
  }

  if (data.status === "no_filing" || data.status === "no_sections") {
    return (
      <div>
        <Header />
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">{data.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <Header />
        {data.filingYear && (
          <span className="text-xs text-muted-foreground">DEU {data.filingYear}</span>
        )}
      </div>

      {data.riskFactors.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">Aucun facteur de risque identifié.</p>
      ) : (
        <ul className="space-y-4">
          {data.riskFactors.map((risk: RiskFactor) => (
            <li key={risk.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="font-semibold text-sm leading-snug">{risk.title}</h3>
                {risk.impactLevel && (
                  <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                    Impact : {risk.impactLevel}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {risk.description}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center gap-2.5 mb-6">
      <AlertTriangle className="w-5 h-5 text-primary" />
      <h2 className="text-2xl font-semibold">Facteurs de risque</h2>
    </div>
  );
}
