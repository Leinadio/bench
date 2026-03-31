"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-64 border-r bg-muted/30 p-4 flex flex-col gap-2">
      <Link href="/" className="font-bold text-lg px-3 py-2 mb-4">
        FilingLens
      </Link>
      <nav className="flex flex-col gap-1">
        <Link
          href="/"
          className={cn(
            "rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
            pathname === "/" && "bg-accent font-medium"
          )}
        >
          Entreprises
        </Link>
      </nav>
    </aside>
  );
}
