"use client";

import { useParams } from "next/navigation";
import { SignalsPanel } from "@/components/company/signals-panel";

export default function CompanySignalsPage() {
  const params = useParams();
  return <SignalsPanel companyId={params.id as string} />;
}
