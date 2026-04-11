"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Calendar, AlertTriangle } from "lucide-react";
import { THEME_LABELS } from "@/lib/types";
import type { Signal, Theme } from "@/lib/types";
import { cn } from "@/lib/utils";

const TYPE_CONFIG = {
  positive: { label: "Haussier", dot: "bg-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-400", arrow: "\u2197" },
  negative: { label: "Baissier", dot: "bg-red-500", bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-400", arrow: "\u2198" },
  neutral: { label: "Neutre", dot: "bg-gray-400", bg: "bg-gray-50 dark:bg-gray-900/30", text: "text-gray-600 dark:text-gray-400", arrow: "\u2192" },
};

export function SignalCard({ signal, companyId }: { signal: Signal; companyId: string }) {
  const config = TYPE_CONFIG[signal.type];
  const pathname = usePathname();
  const isOnCompanyPage = pathname.startsWith(`/company/${companyId}`);

  return (
    <div className="flex gap-3 p-4 rounded-xl border border-border bg-card">
      <div className={cn("w-2.5 h-2.5 rounded-full mt-1.5 shrink-0", config.dot)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-base font-semibold leading-snug">{signal.title}</p>
          <div className="flex items-center gap-1.5 shrink-0">
            {signal.date && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                {signal.date}
              </span>
            )}
            {signal.theme && (
              <Badge variant="secondary" className="text-xs">
                {THEME_LABELS[signal.theme as Theme] ?? signal.theme}
              </Badge>
            )}
            <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full", config.bg, config.text)}>
              {config.arrow} {config.label}
            </span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          {signal.summary}
        </p>
        {signal.justification && (
          <p className={cn("text-xs mt-1.5 leading-relaxed", config.text)}>
            {config.arrow} {signal.justification}
          </p>
        )}
        {signal.relatedRisks && signal.relatedRisks.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            {signal.relatedRisks.map((risk, i) => {
              const themeTarget = signal.theme || "risk";
              const targetId = `theme-${themeTarget}`;

              if (isOnCompanyPage) {
                return (
                  <button
                    key={i}
                    onClick={() => {
                      const el = document.getElementById(targetId);
                      if (el) {
                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                        // Open the collapsible by clicking its trigger
                        const trigger = el.querySelector("[data-state=closed]");
                        if (trigger instanceof HTMLElement) trigger.click();
                      }
                    }}
                  >
                    <Badge
                      variant="outline"
                      className="text-xs font-normal cursor-pointer hover:bg-primary/5 hover:border-primary/30 transition-colors"
                    >
                      {risk}
                    </Badge>
                  </button>
                );
              }

              return (
                <Link
                  key={i}
                  href={`/company/${companyId}#${targetId}`}
                >
                  <Badge
                    variant="outline"
                    className="text-xs font-normal cursor-pointer hover:bg-primary/5 hover:border-primary/30 transition-colors"
                  >
                    {risk}
                  </Badge>
                </Link>
              );
            })}
          </div>
        )}
        <a
          href={signal.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 mt-2"
        >
          <ExternalLink className="w-3 h-3" />
          Source
        </a>
      </div>
    </div>
  );
}
