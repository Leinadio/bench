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
    <div>
      <h1 className="text-2xl font-bold mb-1">FilingLens</h1>
      <p className="text-muted-foreground mb-6">
        Les DEU du CAC 40, simplifi&eacute;s par l&apos;IA.
      </p>
      {loading ? (
        <p className="text-muted-foreground">Chargement...</p>
      ) : companies.length === 0 ? (
        <p className="text-muted-foreground">Aucune entreprise index&eacute;e.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((c) => (
            <CompanyCard key={c.id} {...c} />
          ))}
        </div>
      )}
    </div>
  );
}
