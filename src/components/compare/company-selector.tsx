"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CompanyWithFilings } from "@/lib/types";

interface CompanySelectorProps {
  companies: CompanyWithFilings[];
  selected: string[];
  onToggle: (filingId: string) => void;
  onCompare: () => void;
}

export function CompanySelector({
  companies,
  selected,
  onToggle,
  onCompare,
}: CompanySelectorProps) {
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {companies.map((company) =>
          company.filings
            .filter((f) => f.status === "done")
            .map((filing) => (
              <Badge
                key={filing.id}
                variant={selected.includes(filing.id) ? "default" : "outline"}
                className="cursor-pointer text-sm py-1 px-3"
                onClick={() => onToggle(filing.id)}
              >
                {company.ticker} {filing.year}
              </Badge>
            ))
        )}
      </div>
      <Button onClick={onCompare} disabled={selected.length < 2}>
        Comparer {selected.length} filings
      </Button>
    </div>
  );
}
