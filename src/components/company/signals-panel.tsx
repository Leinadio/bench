"use client";

import { useEffect, useState } from "react";
import { SignalCard } from "./signal-card";
import { Zap } from "lucide-react";
import type { Signal } from "@/lib/types";

interface SignalsPanelProps {
  companyId: string;
  companyName: string;
}

export function SignalsPanel({ companyId }: SignalsPanelProps) {
  const [signals, setSignals] = useState<Signal[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzedAt, setAnalyzedAt] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/signals/${companyId}`)
      .then((r) => r.json())
      .then((data) => {
        setSignals(data.signals);
        setAnalyzedAt(data.analyzedAt);
      })
      .catch(() => setSignals([]))
      .finally(() => setLoading(false));
  }, [companyId]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <Zap className="w-5 h-5 text-primary" />
          <h2 className="text-2xl">Signaux r&eacute;cents</h2>
        </div>
        {analyzedAt && (
          <span className="text-xs text-muted-foreground">
            Mis &agrave; jour{" "}
            {new Date(analyzedAt).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
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
          Chargement des signaux...
        </div>
      )}

      {signals !== null && !loading && (
        <>
          {signals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Aucun signal disponible.
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
            Analyse crois&eacute;e DEU &times; actualit&eacute;s. Ne constitue
            pas un conseil d&apos;investissement.
          </p>
        </>
      )}
    </div>
  );
}
