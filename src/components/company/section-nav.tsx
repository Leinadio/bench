"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

const CATEGORIES = ["risk", "strategy", "governance", "esg", "financial", "other"];

interface SectionNavProps {
  sections: {
    id: string;
    heading: string;
    depth: number;
    category: string;
  }[];
  activeId: string | null;
  onSelect: (id: string) => void;
  categoryFilter: string | null;
  onCategoryFilter: (category: string | null) => void;
}

export function SectionNav({
  sections,
  activeId,
  onSelect,
  categoryFilter,
  onCategoryFilter,
}: SectionNavProps) {
  const filtered = categoryFilter
    ? sections.filter((s) => s.category === categoryFilter)
    : sections;

  return (
    <div className="w-72 border-r flex flex-col">
      <div className="p-3 border-b flex flex-wrap gap-1">
        <Badge
          variant={categoryFilter === null ? "default" : "outline"}
          className="cursor-pointer text-xs"
          onClick={() => onCategoryFilter(null)}
        >
          Tout
        </Badge>
        {CATEGORIES.map((cat) => (
          <Badge
            key={cat}
            variant={categoryFilter === cat ? "default" : "outline"}
            className="cursor-pointer text-xs"
            onClick={() => onCategoryFilter(cat)}
          >
            {cat}
          </Badge>
        ))}
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 flex flex-col gap-0.5">
          {filtered.map((section) => (
            <button
              key={section.id}
              onClick={() => onSelect(section.id)}
              className={cn(
                "text-left px-2 py-1.5 rounded text-sm transition-colors hover:bg-accent truncate",
                section.depth === 2 && "pl-6 text-xs",
                section.depth >= 3 && "pl-10 text-xs",
                activeId === section.id && "bg-accent font-medium"
              )}
            >
              {section.heading}
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
