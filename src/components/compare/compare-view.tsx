import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface CompareFiling {
  id: string;
  year: number;
  company: { name: string; ticker: string };
  sections: {
    id: string;
    heading: string;
    category: string;
    content: string;
  }[];
}

export function CompareView({
  filings,
  category,
}: {
  filings: CompareFiling[];
  category: string;
}) {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${filings.length}, 1fr)` }}
    >
      {filings.map((filing) => (
        <div key={filing.id} className="border rounded-lg">
          <div className="p-3 border-b bg-muted/30 font-medium">
            {filing.company.name} ({filing.company.ticker}) — {filing.year}
          </div>
          <ScrollArea className="h-[600px]">
            <div className="p-4 flex flex-col gap-4">
              {filing.sections.map((section) => (
                <div key={section.id}>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-sm">{section.heading}</h4>
                    <Badge variant="secondary" className="text-xs">
                      {section.category}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-[20]">
                    {section.content}
                  </p>
                </div>
              ))}
              {filing.sections.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Aucune section &quot;{category}&quot; trouvee.
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      ))}
    </div>
  );
}
