"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { SignalsPanel } from "@/components/company/signals-panel";

export default function CompanySignalsPage() {
  const params = useParams();
  const [companyName, setCompanyName] = useState<string>("");

  useEffect(() => {
    fetch(`/api/companies/${params.id}`)
      .then((r) => r.json())
      .then((data) => setCompanyName(data.name));
  }, [params.id]);

  return (
    <SignalsPanel
      companyId={params.id as string}
      companyName={companyName}
    />
  );
}
