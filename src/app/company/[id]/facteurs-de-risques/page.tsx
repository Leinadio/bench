"use client";

import { use } from "react";
import { RiskFactorsPanel } from "@/components/company/risk-factors-panel";

export default function FacteursDeRisquesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <RiskFactorsPanel companyId={id} />;
}
