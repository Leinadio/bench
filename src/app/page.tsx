"use client";

import { useEffect, useState } from "react";
import { CompanyCard } from "@/components/company/company-card";
import type { CompanyWithSummaries } from "@/lib/types";

export default function DashboardPage() {
  const [companies, setCompanies] = useState<CompanyWithSummaries[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/companies")
      .then((r) => r.json())
      .then((data) => {
        setCompanies(data);
        setLoading(false);
      });
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-10 animate-fade-in-up">
        <h1 className="text-4xl mb-2">FilingLens</h1>
        <p className="text-muted-foreground text-lg">
          Les DEU du CAC 40, simplifi&eacute;s par l&apos;IA.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-52 rounded-xl bg-card border border-border shimmer"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      ) : companies.length === 0 ? (
        <p className="text-muted-foreground text-base">Aucune entreprise index&eacute;e.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {companies.map((c, i) => (
            <div
              key={c.id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <CompanyCard {...c} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
