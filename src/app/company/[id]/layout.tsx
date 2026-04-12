"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { CompanySnapshot } from "@/components/company/company-snapshot";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Zap, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CompanySummary } from "@/lib/types";

interface CompanyDetailData {
  id: string;
  name: string;
  ticker: string;
  sector: string;
  filings: {
    id: string;
    year: number;
    summaries: CompanySummary[];
    sectionsByTheme: Record<
      string,
      { id: string; heading: string; content: string }[]
    >;
  }[];
}

export default function CompanyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const [company, setCompany] = useState<CompanyDetailData | null>(null);
  const [activeFilingIndex, setActiveFilingIndex] = useState(0);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/companies/${params.id}`)
      .then((r) => {
        if (!r.ok) {
          setNotFound(true);
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data) setCompany(data);
      })
      .catch(() => setNotFound(true));
  }, [params.id]);

  if (notFound)
    return (
      <div className="max-w-4xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium transition-colors mb-6 group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          Entreprises
        </Link>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <p className="text-lg font-medium mb-2">Entreprise introuvable</p>
          <p className="text-sm text-muted-foreground">
            Cette entreprise n&apos;existe pas ou a &eacute;t&eacute; supprim&eacute;e.
          </p>
        </div>
      </div>
    );

  if (!company)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary/50 loading-dot" />
          <span
            className="w-2 h-2 rounded-full bg-primary/50 loading-dot"
            style={{ animationDelay: "0.2s" }}
          />
          <span
            className="w-2 h-2 rounded-full bg-primary/50 loading-dot"
            style={{ animationDelay: "0.4s" }}
          />
        </div>
      </div>
    );

  const filing = company.filings[activeFilingIndex];
  const globalSummary =
    filing?.summaries.find((s) => s.theme === "global") || null;
  const themeSummaries =
    filing?.summaries.filter((s) => s.theme !== "global") || [];

  const basePath = `/company/${params.id}`;
  const isAnalysis = pathname === basePath;
  const isSignals = pathname === `${basePath}/signals`;
  const isPerspective = pathname === `${basePath}/perspective`;

  const navItems = [
    { href: basePath, label: "Analyse", icon: FileText, active: isAnalysis },
    {
      href: `${basePath}/signals`,
      label: "Signaux",
      icon: Zap,
      active: isSignals,
    },
    {
      href: `${basePath}/perspective`,
      label: "Perspective",
      icon: TrendingUp,
      active: isPerspective,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium transition-colors mb-6 group"
      >
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
        Entreprises
      </Link>

      {company.filings.length > 1 && (
        <div className="flex gap-2 mb-6">
          {company.filings.map((f, i) => (
            <Button
              key={f.id}
              variant={i === activeFilingIndex ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveFilingIndex(i)}
            >
              DEU {f.year}
            </Button>
          ))}
        </div>
      )}

      <CompanySnapshot
        name={company.name}
        ticker={company.ticker}
        sector={company.sector}
        globalSummary={globalSummary}
        themeSummaries={themeSummaries}
      />

      {/* Sub-navigation */}
      <nav className="mt-8 flex gap-1 border-b border-border">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              item.active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-6">{children}</div>
    </div>
  );
}
