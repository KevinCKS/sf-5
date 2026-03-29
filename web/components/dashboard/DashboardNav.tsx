"use client";

import { memo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/dashboard/db", label: "DB" },
  { href: "/dashboard/alert", label: "Alert" },
] as const;

/** 왼쪽 사이드 — 대시보드 / DB / Alert 이동 */
function DashboardNavInner() {
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
            prefetch
            scroll={false}
            // 탭 전환 시 맨 위로 스크롤 복원 생략 — 전환·레이아웃 안정화
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

/** 메인 콘텐츠만 바뀔 때 pathname 불일 시 사이드 내비 리렌더 생략 */
export const DashboardNav = memo(DashboardNavInner);
