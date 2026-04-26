import { Badge } from "@/components/ui/badge";
import type { CompanySummary } from "@/lib/types";

interface CompanySnapshotProps {
  name: string;
  ticker: string;
  sector: string;
  globalSummary: CompanySummary | null;
}

export function CompanySnapshot({ name, ticker, sector, globalSummary }: CompanySnapshotProps) {
  return (
    <div className="animate-fade-in-up">
      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-4xl">{name}</h1>
        <Badge variant="outline" className="font-mono text-xs">{ticker}</Badge>
      </div>
      <p className="text-muted-foreground text-base mb-6">{sector}</p>
      {globalSummary && (
        <div className="p-5 bg-card rounded-xl border border-border">
          <p className="text-base leading-relaxed">{globalSummary.summary}</p>
        </div>
      )}
    </div>
  );
}
