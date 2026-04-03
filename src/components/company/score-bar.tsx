import { ScoreBadge } from "./score-badge";
import { THEME_LABELS, THEME_ORDER } from "@/lib/types";
import type { CompanySummary } from "@/lib/types";

interface ScoreBarProps {
  summaries: CompanySummary[];
  size?: "sm" | "md";
}

export function ScoreBar({ summaries, size = "md" }: ScoreBarProps) {
  return (
    <div className="flex gap-5">
      {THEME_ORDER.map((theme) => {
        const summary = summaries.find((s) => s.theme === theme);
        if (!summary) return null;
        return (
          <ScoreBadge
            key={theme}
            score={summary.score}
            label={THEME_LABELS[theme]}
            size={size}
          />
        );
      })}
    </div>
  );
}
