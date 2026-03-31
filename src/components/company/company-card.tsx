import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreBar } from "./score-bar";
import type { CompanyWithSummaries } from "@/lib/types";

export function CompanyCard({
  id,
  name,
  ticker,
  sector,
  filings,
  globalSummary,
  themeSummaries,
}: CompanyWithSummaries) {
  return (
    <Link href={`/company/${id}`}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{name}</CardTitle>
            <Badge variant="secondary">{ticker}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{sector}</p>
        </CardHeader>
        <CardContent>
          {themeSummaries.length > 0 ? (
            <>
              <ScoreBar summaries={themeSummaries} size="sm" />
              {globalSummary && (
                <p className="text-xs text-muted-foreground mt-3 line-clamp-2">
                  {globalSummary.summary}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              {filings.length > 0 ? "Fiches en cours..." : "Aucun DEU index\u00e9"}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
