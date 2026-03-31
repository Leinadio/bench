"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScoreBadge } from "./score-badge";
import { THEME_LABELS } from "@/lib/types";
import type { CompanySummary, Theme } from "@/lib/types";

interface ThemeCardProps {
  summary: CompanySummary;
  sourceSections?: { id: string; heading: string; content: string }[];
}

export function ThemeCard({ summary, sourceSections }: ThemeCardProps) {
  const [open, setOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="transition-colors hover:border-primary/30">
        <CardHeader className="cursor-pointer p-0">
          <CollapsibleTrigger className="w-full text-left p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ScoreBadge score={summary.score} label="" size="sm" />
                <div>
                  <CardTitle className="text-base">
                    {THEME_LABELS[summary.theme as Theme] || summary.theme}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {summary.summary.split(".")[0]}.
                  </p>
                </div>
              </div>
              <span className="text-muted-foreground text-sm">
                {open ? "\u25B2" : "\u25BC"}
              </span>
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="mb-3">
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Score : {summary.score}/5 &mdash; {summary.scoreJustification}
              </p>
            </div>
            <p className="text-sm mb-4">{summary.summary}</p>
            <h4 className="text-sm font-semibold mb-2">Points cl&eacute;s</h4>
            <ul className="space-y-1.5 mb-4">
              {summary.bulletPoints.map((point, i) => (
                <li key={i} className="text-sm flex gap-2">
                  <span className="text-muted-foreground shrink-0">
                    &bull;
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            {sourceSections && sourceSections.length > 0 && (
              <Collapsible open={sourceOpen} onOpenChange={setSourceOpen}>
                <CollapsibleTrigger className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  {sourceOpen ? "\u25B2 Masquer" : "\u25BC Voir"} les sections
                  sources du DEU ({sourceSections.length})
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-3 space-y-3 border-t pt-3">
                    {sourceSections.map((section) => (
                      <div key={section.id}>
                        <h5 className="text-xs font-semibold text-muted-foreground">
                          {section.heading}
                        </h5>
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-1 max-h-40 overflow-auto">
                          {section.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
