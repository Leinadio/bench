"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Building2, ScanSearch, Moon, Sun } from "lucide-react";

const navItems = [
  { href: "/", label: "Entreprises", icon: Building2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  return (
    <aside className="w-60 border-r border-sidebar-border bg-sidebar flex flex-col">
      {/* Logo */}
      <div className="px-5 py-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <ScanSearch className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-heading text-base font-bold text-sidebar-foreground">
            FilingLens
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3">
        {navItems.map((item) => {
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 relative",
                isActive
                  ? "text-primary bg-primary/[0.06]"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-2 bottom-2 w-[3px] bg-primary rounded-full" />
              )}
              <item.icon className="w-[18px] h-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-sidebar-border flex items-center justify-between">
        <p className="text-xs text-muted-foreground/50">FilingLens v1.0</p>
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-1.5 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <Sun className="w-4 h-4 hidden dark:block" />
          <Moon className="w-4 h-4 block dark:hidden" />
        </button>
      </div>
    </aside>
  );
}
