"use client";

import { useParams } from "next/navigation";
import { PerspectivePanel } from "@/components/company/perspective-panel";

export default function CompanyPerspectivePage() {
  const params = useParams();
  return <PerspectivePanel companyId={params.id as string} />;
}
