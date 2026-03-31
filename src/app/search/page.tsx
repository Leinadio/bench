"use client";

import { useState } from "react";
import { SearchBar } from "@/components/search/search-bar";
import { SearchResults } from "@/components/search/search-results";
import type { SearchResult } from "@/lib/types";

export default function SearchPage() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (query: string) => {
    setLoading(true);
    setSearched(true);
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setResults(data);
    setLoading(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Recherche</h1>
      <p className="text-muted-foreground mb-6">
        Recherche full-text dans tous les Documents d&apos;Enregistrement
        Universel indexes.
      </p>
      <SearchBar onSearch={handleSearch} loading={loading} />
      {searched && <SearchResults results={results} />}
    </div>
  );
}
