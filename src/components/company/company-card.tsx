import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CompanyCardProps {
  id: string;
  name: string;
  ticker: string;
  sector: string;
  filings: { id: string; year: number; status: string; sectionCount: number }[];
}

export function CompanyCard({
  id,
  name,
  ticker,
  sector,
  filings,
}: CompanyCardProps) {
  const latestFiling = filings[0];
  const totalSections = filings.reduce((acc, f) => acc + f.sectionCount, 0);
  return (
    <Link href={`/company/${id}`}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{name}</CardTitle>
            <Badge variant="secondary">{ticker}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{sector}</span>
            <span>
              {filings.length} filing{filings.length > 1 ? "s" : ""}
            </span>
            <span>{totalSections} sections</span>
          </div>
          {latestFiling && (
            <div className="mt-2 text-xs text-muted-foreground">
              Dernier : {latestFiling.year} —{" "}
              {latestFiling.status === "done" ? "Fait" : "En cours"}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
