"use client";

import { memo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Database, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", label: "대시보드", Icon: LayoutDashboard },
  { href: "/dashboard/db", label: "DB", Icon: Database },
  { href: "/dashboard/alert", label: "Alert", Icon: Bell },
] as const;

/** 왼쪽 사이드 — 대시보드 / DB / Alert 이동 */
function DashboardNavInner() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1" aria-label="주 메뉴">
      {ITEMS.map(({ href, label, Icon }) => {
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
              // 기본 text-sm(0.875rem) 대비 글자 1.6배 → 1.4rem
              "inline-flex items-center gap-2.5 rounded-full px-3 py-2.5 text-[1.4rem] font-medium transition-all duration-200",
              active
                ? "bg-primary/20 text-primary shadow-[0_0_18px_-6px_oklch(0.75_0.09_175_/_0.55)] ring-1 ring-primary/35"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
            )}
          >
            <Icon
              className="size-[1.6rem] shrink-0 opacity-90"
              aria-hidden
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** 메인 콘텐츠만 바뀔 때 pathname 불일 시 사이드 내비 리렌더 생략 */
export const DashboardNav = memo(DashboardNavInner);
