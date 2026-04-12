"use client";

import { useEffect, useState } from "react";
import { TrendingUp, AlertTriangle, Sparkles, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BIAS_CONFIG,
  CONVICTION_LABELS,
} from "@/lib/types";
import type { PerspectiveResponse, PerspectiveData } from "@/lib/types";

interface PerspectivePanelProps {
  companyId: string;
}

export function PerspectivePanel({ companyId }: PerspectivePanelProps) {
  const [data, setData] = useState<PerspectiveResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const abortController = new AbortController();

    fetch(`/api/perspective/${companyId}`, {
      signal: abortController.signal,
    })
      .then((r) => r.json())
      .then((json: PerspectiveResponse) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
        setData({ perspective: null, status: "error", message: "Impossible de charger la perspective" });
        setLoading(false);
      });

    return () => abortController.abort();
  }, [companyId]);

  if (loading) {
    return (
      <div>
        <div className="flex items-center gap-2.5 mb-6">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h2 className="text-2xl">Perspective</h2>
        </div>
        <div className="space-y-4">
          <div className="h-24 rounded-xl bg-muted/50 animate-pulse" />
          <div className="h-32 rounded-xl bg-muted/50 animate-pulse" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-28 rounded-xl bg-muted/50 animate-pulse" />
            <div className="h-28 rounded-xl bg-muted/50 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.status === "error") {
    return (
      <div>
        <div className="flex items-center gap-2.5 mb-6">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h2 className="text-2xl">Perspective</h2>
        </div>
        <p className="text-sm text-destructive py-4">
          {data?.message ?? "Impossible de charger la perspective"}
        </p>
      </div>
    );
  }

  if (data.status === "insufficient_data") {
    return (
      <div>
        <div className="flex items-center gap-2.5 mb-6">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h2 className="text-2xl">Perspective</h2>
        </div>
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">{data.message}</p>
        </div>
      </div>
    );
  }

  const p = data.perspective as PerspectiveData;
  const biasConfig = BIAS_CONFIG[p.bias];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h2 className="text-2xl">Perspective</h2>
        </div>
        <span className="text-xs text-muted-foreground">
          G&eacute;n&eacute;r&eacute;e le{" "}
          {new Date(p.generatedAt).toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      {/* Bloc 1: Verdict */}
      <div className={cn("rounded-xl border p-5 mb-6", biasConfig.bgColor)}>
        <div className="flex items-center justify-between mb-3">
          <span className={cn("text-xl font-bold", biasConfig.color)}>
            {biasConfig.arrow} {biasConfig.label}
          </span>
          <span className="text-sm text-muted-foreground">
            Conviction : <strong>{CONVICTION_LABELS[p.conviction]}</strong>
          </span>
        </div>

        {/* Bloc 2: Synthèse */}
        <p className="text-sm leading-relaxed">{p.summary}</p>
      </div>

      {/* Bloc 3 & 4: Risques et Catalyseurs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Risques clés */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h3 className="font-semibold text-sm">Risques cl&eacute;s</h3>
          </div>
          {p.risks.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucun risque majeur identifi&eacute;</p>
          ) : (
            <ul className="space-y-2">
              {p.risks.map((risk, i) => (
                <li key={i}>
                  <p className="text-sm font-medium">{risk.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {risk.description}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Catalyseurs potentiels */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-emerald-500" />
            <h3 className="font-semibold text-sm">Catalyseurs potentiels</h3>
          </div>
          {p.catalysts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucun catalyseur identifi&eacute;</p>
          ) : (
            <ul className="space-y-2">
              {p.catalysts.map((cat, i) => (
                <li key={i}>
                  <p className="text-sm font-medium">{cat.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {cat.description}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Métriques */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">M&eacute;triques</h3>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>
            Signaux :{" "}
            <strong className="text-emerald-500">{p.metrics.signalsBullish} haussiers</strong>
            {" / "}
            <strong className="text-red-500">{p.metrics.signalsBearish} baissiers</strong>
            {" / "}
            <strong>{p.metrics.signalsNeutral} neutres</strong>
          </span>
          {p.metrics.riskScore !== null && (
            <span>Risque DEU : <strong>{p.metrics.riskScore}/5</strong></span>
          )}
          {p.metrics.strategyScore !== null && (
            <span>Strat&eacute;gie DEU : <strong>{p.metrics.strategyScore}/5</strong></span>
          )}
          <span>Total : <strong>{p.metrics.totalSignals} signaux analys&eacute;s</strong></span>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground mt-4">
        Perspective qualitative bas&eacute;e sur l&apos;analyse crois&eacute;e DEU &times;
        actualit&eacute;s. Ne constitue pas un conseil d&apos;investissement.
      </p>
    </div>
  );
}
