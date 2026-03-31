"use client";

import { useEffect, useState } from "react";
import { CompanySelector } from "@/components/compare/company-selector";
import { CompareView } from "@/components/compare/compare-view";
import { Badge } from "@/components/ui/badge";
import type { CompanyWithFilings } from "@/lib/types";

const CATEGORIES = ["risk", "strategy", "governance", "esg", "financial"];

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

export default function ComparePage() {
  const [companies, setCompanies] = useState<CompanyWithFilings[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [category, setCategory] = useState("risk");
  const [compareData, setCompareData] = useState<CompareFiling[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/companies")
      .then((r) => r.json())
      .then(setCompanies);
  }, []);

  const handleToggle = (filingId: string) => {
    setSelected((prev) =>
      prev.includes(filingId)
        ? prev.filter((id) => id !== filingId)
        : [...prev, filingId]
    );
    setCompareData(null);
  };

  const handleCompare = async () => {
    setLoading(true);
    const res = await fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filingIds: selected, category }),
    });
    setCompareData(await res.json());
    setLoading(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Comparer</h1>
      <p className="text-muted-foreground mb-6">
        Comparez les sections de plusieurs DEU cote a cote.
      </p>
      <CompanySelector
        companies={companies}
        selected={selected}
        onToggle={handleToggle}
        onCompare={handleCompare}
      />
      <div className="flex gap-2 my-4">
        {CATEGORIES.map((cat) => (
          <Badge
            key={cat}
            variant={category === cat ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => {
              setCategory(cat);
              setCompareData(null);
            }}
          >
            {cat}
          </Badge>
        ))}
      </div>
      {loading && <p className="text-muted-foreground">Chargement...</p>}
      {compareData && (
        <CompareView filings={compareData} category={category} />
      )}
    </div>
  );
}
