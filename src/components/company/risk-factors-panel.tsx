"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import type { RiskCategory, RiskFactorsResponse } from "@/lib/types";

const CRITICALITY_CONFIG: Record<number, { label: string; className: string }> = {
  1: { label: "Critique", className: "bg-red-100 text-red-800" },
  2: { label: "Important", className: "bg-orange-100 text-orange-800" },
  3: { label: "Modéré", className: "bg-yellow-100 text-yellow-700" },
};

interface Props {
  companyId: string;
}

export function RiskFactorsPanel({ companyId }: Props) {
  const [data, setData] = useState<{
    categories: RiskCategory[];
    filingYear?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/risk-factors/${companyId}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((res: RiskFactorsResponse) => {
        if (
          res.status === "error" ||
          res.status === "no_filing" ||
          res.status === "no_local_path" ||
          res.status === "no_sections"
        ) {
          setError(res.message ?? "Données indisponibles.");
        } else {
          setData({ categories: res.categories, filingYear: res.filingYear });
        }
        setLoading(false);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError("Erreur lors du chargement.");
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [companyId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-muted-foreground">{error}</p>;
  }

  if (!data || data.categories.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucun facteur de risque disponible.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {data.filingYear && (
        <p className="text-sm text-muted-foreground">DEU {data.filingYear}</p>
      )}

      {data.categories.map((cat) => (
        <section key={cat.id}>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            {cat.name}
          </h3>

          <div className="divide-y divide-border border rounded-lg">
            {cat.factors.map((factor) => {
              const crit =
                CRITICALITY_CONFIG[factor.criticalityScore] ??
                CRITICALITY_CONFIG[2];
              return (
                <Collapsible key={factor.id}>
                  <CollapsibleTrigger className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors [&[data-open]>svg:last-child]:rotate-180">
                    <span className="flex items-center gap-3 min-w-0">
                      {factor.sectionRef && (
                        <span className="shrink-0 text-xs text-muted-foreground font-mono">
                          {factor.sectionRef}
                        </span>
                      )}
                      <span className="text-sm font-medium leading-snug">
                        {factor.title}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${crit.className}`}
                      >
                        {crit.label}
                      </span>
                      <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform duration-200" />
                    </span>
                  </CollapsibleTrigger>

                  <CollapsibleContent className="px-4 pb-5 pt-3">
                    <div className="space-y-6">
                      {factor.items.map((item, idx) => (
                        <div
                          key={item.id}
                          className={
                            idx > 0
                              ? "pt-6 border-t border-dashed border-border"
                              : undefined
                          }
                        >
                          <div className="space-y-4">
                            <div>
                              <h5 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                                Description du risque
                              </h5>
                              <div className="space-y-2">
                                {item.description
                                  .split("\n")
                                  .filter((l) => l.trim())
                                  .map((line, i) => (
                                    <p key={i} className="text-sm leading-relaxed">
                                      {line.trim()}
                                    </p>
                                  ))}
                              </div>
                            </div>
                            <div>
                              <h5 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                                Gestion du risque
                              </h5>
                              <div className="space-y-2">
                                {item.riskManagement
                                  .split("\n")
                                  .filter((l) => l.trim())
                                  .map((line, i) => (
                                    <p key={i} className="text-sm leading-relaxed">
                                      {line.trim()}
                                    </p>
                                  ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
