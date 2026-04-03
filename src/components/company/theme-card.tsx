"use client";

import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { CompanySummary } from "@/lib/types";
import {
  ShieldAlert,
  Compass,
  ChevronDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const THEME_CONFIG: Record<
  string,
  { icon: LucideIcon; accent: string; bg: string }
> = {
  risk: {
    icon: ShieldAlert,
    accent: "text-red-500",
    bg: "bg-red-50",
  },
  strategy: {
    icon: Compass,
    accent: "text-blue-500",
    bg: "bg-blue-50",
  },
};

interface ThemeCardProps {
  summary: CompanySummary;
  sourceSections?: { id: string; heading: string; content: string }[];
}

export function ThemeCard({ summary, sourceSections }: ThemeCardProps) {
  const [sourceOpen, setSourceOpen] = useState(false);
  const [openCategories, setOpenCategories] = useState<Set<number>>(
    new Set([0])
  );
  const hasSourceSections = sourceSections && sourceSections.length > 0;

  const toggleCategory = (index: number) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Score */}
      <div className="p-4 rounded-lg bg-muted/50">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">
            Score : {summary.score}/5
          </span>{" "}
          &mdash; {summary.scoreJustification}
        </p>
      </div>

      {/* Résumé */}
      <div>
        <h4 className="text-sm font-semibold text-muted-foreground mb-2">
          R&eacute;sum&eacute;
        </h4>
        <p className="text-base leading-relaxed">{summary.summary}</p>
      </div>

      {/* Points clés par catégorie */}
      <div>
        <h4 className="text-sm font-semibold text-muted-foreground mb-3">
          Points cl&eacute;s
        </h4>
        <div className="space-y-1">
          {summary.bulletPoints.map((group, i) => {
            const isOpen = openCategories.has(i);
            return (
              <Collapsible
                key={i}
                open={isOpen}
                onOpenChange={() => toggleCategory(i)}
              >
                <CollapsibleTrigger className="w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 text-muted-foreground/60 transition-transform duration-200 shrink-0",
                      isOpen && "rotate-180"
                    )}
                  />
                  <span className="text-sm font-medium flex-1">
                    {group.category}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {group.points.length}
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ul className="space-y-2 pl-9 pr-3 pb-2">
                    {group.points.map((point, j) => (
                      <li key={j} className="text-sm flex gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                        <span className="leading-relaxed">{point}</span>
                      </li>
                    ))}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </div>

      {/* Sources (collapsible) */}
      {hasSourceSections && (
        <Collapsible open={sourceOpen} onOpenChange={setSourceOpen}>
          <CollapsibleTrigger className="text-sm text-primary hover:text-primary/80 font-medium transition-colors flex items-center gap-1.5">
            <ChevronDown
              className={cn(
                "w-4 h-4 transition-transform duration-200",
                sourceOpen && "rotate-180"
              )}
            />
            {sourceOpen ? "Masquer" : "Voir"} les sections sources (
            {sourceSections.length})
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-3 space-y-3 border-t pt-3">
              {sourceSections.map((section) => (
                <div key={section.id}>
                  <h5 className="text-sm font-semibold text-foreground">
                    {section.heading}
                  </h5>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1 max-h-40 overflow-auto leading-relaxed">
                    {section.content}
                  </p>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
