"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/dashboard/db", label: "DB" },
  { href: "/dashboard/alert", label: "Alert" },
] as const;

/** 왼쪽 사이드 — 대시보드 / DB / Alert 이동 */
export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1" aria-label="주 메뉴">
      {ITEMS.map(({ href, label }) => {
        const active =
          href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "rounded-full px-3 py-2 text-sm font-medium transition-all duration-200",
              active
                ? "bg-gradient-to-r from-cyan-500/90 to-blue-600/90 text-white shadow-[0_0_20px_-4px_rgba(34,211,238,0.45)]"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
