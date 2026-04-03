import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
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
    <Link href={`/company/${id}`} className="group block">
      <Card className="h-full transition-all duration-200 hover:shadow-md hover:border-primary/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{name}</CardTitle>
            <Badge variant="outline" className="font-mono text-xs">
              {ticker}
            </Badge>
          </div>
          <CardDescription>{sector}</CardDescription>
        </CardHeader>
        <CardContent>
          {themeSummaries.length > 0 ? (
            <ScoreBar summaries={themeSummaries} size="sm" />
          ) : (
            <p className="text-sm text-muted-foreground">
              {filings.length > 0
                ? "Fiches en cours..."
                : "Aucun DEU index\u00e9"}
            </p>
          )}
        </CardContent>
        {globalSummary && (
          <CardFooter>
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {globalSummary.summary}
            </p>
          </CardFooter>
        )}
      </Card>
    </Link>
  );
}
