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
import type { CompanyWithSummaries } from "@/lib/types";

export function CompanyCard({
  id,
  name,
  ticker,
  sector,
  filings,
  globalSummary,
}: CompanyWithSummaries) {
  return (
    <Link href={`/company/${id}`} className="group block">
      <Card className="h-full transition-all duration-200 hover:shadow-md hover:border-primary/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{name}</CardTitle>
            <Badge variant="outline" className="font-mono text-xs">{ticker}</Badge>
          </div>
          <CardDescription>{sector}</CardDescription>
        </CardHeader>
        <CardContent>
          {filings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun DEU index&eacute;</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {filings.length} DEU index&eacute;{filings.length > 1 ? "s" : ""}
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
