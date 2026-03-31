import { ScoreBar } from "./score-bar";
import type { CompanySummary } from "@/lib/types";

interface CompanySnapshotProps {
  name: string;
  ticker: string;
  sector: string;
  globalSummary: CompanySummary | null;
  themeSummaries: CompanySummary[];
}

export function CompanySnapshot({
  name,
  ticker,
  sector,
  globalSummary,
  themeSummaries,
}: CompanySnapshotProps) {
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-2xl font-bold">{name}</h1>
        <span className="text-lg text-muted-foreground">{ticker}</span>
      </div>
      <p className="text-muted-foreground mb-4">{sector}</p>
      <ScoreBar summaries={themeSummaries} />
      {globalSummary && (
        <div className="mt-4 p-4 bg-muted/30 rounded-lg">
          <p className="text-sm">{globalSummary.summary}</p>
        </div>
      )}
    </div>
  );
}
