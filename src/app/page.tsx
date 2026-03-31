"use client";

import { useEffect, useState } from "react";
import { CompanyCard } from "@/components/company/company-card";
import type { CompanyWithFilings } from "@/lib/types";

export default function DashboardPage() {
  const [companies, setCompanies] = useState<CompanyWithFilings[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/companies")
      .then((r) => r.json())
      .then((data) => {
        setCompanies(data);
        setLoading(false);
      });
  }, []);

  const totalFilings = companies.reduce(
    (acc, c) => acc + c.filings.length,
    0
  );
  const totalSections = companies.reduce(
    (acc, c) => acc + c.filings.reduce((a, f) => a + f.sectionCount, 0),
    0
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
      <p className="text-muted-foreground mb-6">
        {companies.length} societes &middot; {totalFilings} filings &middot;{" "}
        {totalSections} sections indexees
      </p>
      {loading ? (
        <p className="text-muted-foreground">Chargement...</p>
      ) : companies.length === 0 ? (
        <p className="text-muted-foreground">
          Aucune societe. Lancez le pipeline pour indexer un DEU.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((company) => (
            <CompanyCard key={company.id} {...company} />
          ))}
        </div>
      )}
    </div>
  );
}
