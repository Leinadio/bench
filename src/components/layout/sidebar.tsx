"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/search", label: "Recherche", icon: "🔍" },
  { href: "/compare", label: "Comparer", icon: "⚖️" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-64 border-r bg-muted/30 p-4 flex flex-col gap-2">
      <div className="font-bold text-lg px-3 py-2 mb-4">FilingLens</div>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
              pathname === item.href && "bg-accent font-medium"
            )}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
