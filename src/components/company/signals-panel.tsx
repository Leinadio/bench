"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SignalCard } from "./signal-card";
import { Zap, RefreshCw } from "lucide-react";
import type { Signal } from "@/lib/types";

interface SignalsPanelProps {
  companyId: string;
  companyName: string;
}

export function SignalsPanel({ companyId, companyName }: SignalsPanelProps) {
  const [signals, setSignals] = useState<Signal[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [articleCount, setArticleCount] = useState(0);

  const fetchSignals = async (refresh = false) => {
    setLoading(true);
    try {
      const url = `/api/signals/${companyId}${refresh ? "?refresh=1" : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      setSignals(data.signals);
      setArticleCount(data.articleCount);
    } catch {
      setSignals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSignals();
  }, [companyId]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <Zap className="w-5 h-5 text-primary" />
          <h2 className="text-2xl">Signaux récents</h2>
        </div>
        {signals !== null && !loading && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchSignals(true)}
            className="text-xs gap-1.5"
          >
            <RefreshCw className="w-3 h-3" />
            Rafra&icirc;chir
          </Button>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <div className="flex gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary/50 loading-dot" />
            <span className="w-2 h-2 rounded-full bg-primary/50 loading-dot" style={{ animationDelay: "0.2s" }} />
            <span className="w-2 h-2 rounded-full bg-primary/50 loading-dot" style={{ animationDelay: "0.4s" }} />
          </div>
          Analyse de {companyName} en cours...
        </div>
      )}

      {signals !== null && !loading && (
        <>
          {signals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              {articleCount === 0
                ? "Aucune actualit\u00e9 r\u00e9cente trouv\u00e9e."
                : "Aucun signal identifi\u00e9."}
            </p>
          ) : (
            <div className="space-y-3">
              {signals.map((signal, i) => (
                <div
                  key={i}
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <SignalCard signal={signal} companyId={companyId} />
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-4">
            Analyse crois&eacute;e DEU × actualit&eacute;s ({articleCount} articles). Ne constitue pas un conseil d&apos;investissement.
          </p>
        </>
      )}
    </div>
  );
}
