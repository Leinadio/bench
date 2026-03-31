import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SearchResult } from "@/lib/types";

export function SearchResults({ results }: { results: SearchResult[] }) {
  if (results.length === 0)
    return <p className="text-muted-foreground mt-4">Aucun resultat.</p>;

  return (
    <div className="flex flex-col gap-3 mt-4">
      {results.map((result) => (
        <Card
          key={result.id}
          className="hover:border-primary/50 transition-colors"
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary">{result.category}</Badge>
              <span className="text-sm font-medium">
                {result.companyName} ({result.companyTicker})
              </span>
              <span className="text-xs text-muted-foreground">
                {result.filingYear}
              </span>
            </div>
            <h3 className="font-medium mb-1">{result.heading}</h3>
            <p className="text-sm text-muted-foreground line-clamp-3">
              {result.snippet}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
