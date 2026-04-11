"use client";

import { useEffect, useState } from "react";
import { SignalCard } from "./signal-card";
import { Zap } from "lucide-react";
import type { Signal } from "@/lib/types";

interface SignalsPanelProps {
  companyId: string;
  companyName: string;
}

interface StreamEvent {
  type: "cached" | "signal" | "done" | "error";
  signals?: Signal[];
  signal?: Signal;
  message?: string;
}

export function SignalsPanel({ companyId }: SignalsPanelProps) {
  const [signals, setSignals] = useState<Signal[] | null>(null);
  const [loadingCache, setLoadingCache] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzedAt, setAnalyzedAt] = useState<Date | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    const consumeStream = async () => {
      try {
        const res = await fetch(`/api/signals/${companyId}/stream`, {
          signal: abortController.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          let newlineIdx;
          while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, newlineIdx).trim();
            buffer = buffer.slice(newlineIdx + 1);
            if (!line) continue;

            let event: StreamEvent;
            try {
              event = JSON.parse(line);
            } catch {
              continue;
            }

            if (event.type === "cached") {
              setSignals(event.signals ?? []);
              setLoadingCache(false);
              setRefreshing(true);
            } else if (event.type === "signal" && event.signal) {
              setSignals((prev) => {
                const next = [event.signal!, ...(prev ?? [])];
                return next;
              });
              setAnalyzedAt(new Date());
            } else if (event.type === "done") {
              setRefreshing(false);
            } else if (event.type === "error") {
              setError(event.message ?? "Erreur inconnue");
              setRefreshing(false);
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error("[SignalsPanel] Stream error:", err);
        setError("Impossible de charger les signaux");
        setLoadingCache(false);
        setRefreshing(false);
      }
    };

    consumeStream();
    return () => abortController.abort();
  }, [companyId]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <Zap className="w-5 h-5 text-primary" />
          <h2 className="text-2xl">Signaux r&eacute;cents</h2>
        </div>
        <div className="flex items-center gap-3">
          {refreshing && (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-2">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/50 loading-dot" />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-primary/50 loading-dot"
                  style={{ animationDelay: "0.2s" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-primary/50 loading-dot"
                  style={{ animationDelay: "0.4s" }}
                />
              </span>
              Recherche de nouveaux signaux...
            </span>
          )}
          {!refreshing && analyzedAt && (
            <span className="text-xs text-muted-foreground">
              Mis &agrave; jour{" "}
              {analyzedAt.toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
      </div>

      {loadingCache && (
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

      {!loadingCache && signals !== null && (
        <>
          {signals.length === 0 && !refreshing ? (
            <p className="text-sm text-muted-foreground py-4">
              Aucun signal disponible.
            </p>
          ) : (
            <div className="space-y-3">
              {signals.map((signal, i) => (
                <div
                  key={`${signal.sourceUrl}-${i}`}
                  className="animate-fade-in-up"
                  style={{ animationDelay: i < 5 ? `${i * 0.05}s` : "0s" }}
                >
                  <SignalCard signal={signal} companyId={companyId} />
                </div>
              ))}
            </div>
          )}
          {error && (
            <p className="text-xs text-destructive mt-3">{error}</p>
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
