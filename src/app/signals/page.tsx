"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SignalCard } from "@/components/company/signal-card";
import { Zap, RefreshCw } from "lucide-react";
import type { Signal } from "@/lib/types";

interface CompanyBasic {
  id: string;
  name: string;
  ticker: string;
  sector: string;
}

interface CompanySignals {
  signals: Signal[] | null;
  loading: boolean;
  articleCount: number;
}

export default function SignalsPage() {
  const [companies, setCompanies] = useState<CompanyBasic[]>([]);
  const [signalsMap, setSignalsMap] = useState<Record<string, CompanySignals>>({});

  const analyzeCompany = async (companyId: string, refresh = false) => {
    setSignalsMap((prev) => ({
      ...prev,
      [companyId]: { signals: prev[companyId]?.signals ?? null, loading: true, articleCount: 0 },
    }));

    try {
      const url = `/api/signals/${companyId}${refresh ? "?refresh=1" : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      setSignalsMap((prev) => ({
        ...prev,
        [companyId]: {
          signals: data.signals,
          loading: false,
          articleCount: data.articleCount,
        },
      }));
    } catch {
      setSignalsMap((prev) => ({
        ...prev,
        [companyId]: { signals: [], loading: false, articleCount: 0 },
      }));
    }
  };

  useEffect(() => {
    fetch("/api/companies")
      .then((r) => r.json())
      .then((data: CompanyBasic[]) => {
        setCompanies(data);
        // Auto-analyze all companies
        data.forEach((c) => analyzeCompany(c.id));
      });
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-10 animate-fade-in-up">
        <div className="flex items-center gap-2.5 mb-2">
          <Zap className="w-6 h-6 text-primary" />
          <h1 className="text-4xl">Signaux</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Analyse crois&eacute;e DEU × actualit&eacute;s r&eacute;centes.
        </p>
      </div>

      <div className="space-y-4">
        {companies.map((company) => {
          const state = signalsMap[company.id];
          return (
            <Card key={company.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{company.name}</CardTitle>
                    <CardDescription>
                      {company.sector} — <Badge variant="outline" className="font-mono text-xs">{company.ticker}</Badge>
                    </CardDescription>
                  </div>
                  {state?.signals && !state.loading && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => analyzeCompany(company.id, true)}
                      className="text-xs gap-1.5"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Rafra&icirc;chir
                    </Button>
                  )}
                </div>
              </CardHeader>

              {state?.loading && (
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-primary/50 loading-dot" />
                      <span className="w-2 h-2 rounded-full bg-primary/50 loading-dot" style={{ animationDelay: "0.2s" }} />
                      <span className="w-2 h-2 rounded-full bg-primary/50 loading-dot" style={{ animationDelay: "0.4s" }} />
                    </div>
                    Analyse en cours...
                  </div>
                </CardContent>
              )}

              {state?.signals && !state.loading && (
                <CardContent>
                  {state.signals.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun signal identifi&eacute;.</p>
                  ) : (
                    <div className="space-y-3">
                      {state.signals.map((signal, i) => (
                        <SignalCard key={i} signal={signal} companyId={company.id} />
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-3">
                    {state.articleCount} articles analys&eacute;s. Ne constitue pas un conseil d&apos;investissement.
                  </p>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
