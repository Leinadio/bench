"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { SectionNav } from "@/components/company/section-nav";
import { SectionContent } from "@/components/company/section-content";
import { QAChat } from "@/components/company/qa-chat";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Section {
  id: string;
  heading: string;
  depth: number;
  category: string;
  content: string;
  orderIndex: number;
}

interface Filing {
  id: string;
  year: number;
  sections: Section[];
}

interface CompanyDetail {
  id: string;
  name: string;
  ticker: string;
  sector: string;
  filings: Filing[];
}

export default function CompanyPage() {
  const params = useParams();
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [activeFilingIndex, setActiveFilingIndex] = useState(0);

  useEffect(() => {
    fetch(`/api/companies/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        setCompany(data);
        if (data.filings?.[0]?.sections?.[0]) {
          setActiveSectionId(data.filings[0].sections[0].id);
        }
      });
  }, [params.id]);

  if (!company) return <p className="text-muted-foreground">Chargement...</p>;

  const filing = company.filings[activeFilingIndex];
  if (!filing) return <p>Aucun filing disponible.</p>;

  const activeSection = filing.sections.find((s) => s.id === activeSectionId);

  return (
    <div className="flex flex-col h-full -m-6">
      <div className="p-6 pb-3 border-b">
        <h1 className="text-2xl font-bold">
          {company.name} ({company.ticker})
        </h1>
        <p className="text-muted-foreground">{company.sector}</p>
        {company.filings.length > 1 && (
          <div className="flex gap-2 mt-2">
            {company.filings.map((f, i) => (
              <button
                key={f.id}
                onClick={() => {
                  setActiveFilingIndex(i);
                  setActiveSectionId(f.sections[0]?.id || null);
                }}
                className={`text-sm px-3 py-1 rounded ${
                  i === activeFilingIndex
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {f.year}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-1 overflow-hidden">
        <SectionNav
          sections={filing.sections}
          activeId={activeSectionId}
          onSelect={setActiveSectionId}
          categoryFilter={categoryFilter}
          onCategoryFilter={setCategoryFilter}
        />
        <div className="flex-1 overflow-auto p-6">
          <Tabs defaultValue="content">
            <TabsList>
              <TabsTrigger value="content">Contenu</TabsTrigger>
              <TabsTrigger value="qa">Q&A</TabsTrigger>
            </TabsList>
            <TabsContent value="content" className="mt-4">
              {activeSection ? (
                <SectionContent {...activeSection} />
              ) : (
                <p className="text-muted-foreground">
                  Selectionnez une section.
                </p>
              )}
            </TabsContent>
            <TabsContent value="qa" className="mt-4">
              <QAChat filingId={filing.id} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
