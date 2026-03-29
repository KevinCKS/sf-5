"use client";

import { memo, type ReactNode } from "react";
import { UserRound } from "lucide-react";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { DashboardRoutePrefetch } from "@/components/dashboard/DashboardRoutePrefetch";

type DashboardShellProps = {
  children: ReactNode;
  userEmail: string | null;
};

/** 좌측 내비 + 가운데 메인 영역 — MQTT 힌트 등으로 Provider만 갱신될 때 children 참조 동일하면 스킵 */
export const DashboardShell = memo(function DashboardShell({
  children,
  userEmail,
}: DashboardShellProps) {
  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col md:flex-row">
      <DashboardRoutePrefetch />
      {/* sticky + self-start: 세로 스크롤 시에도 탭·브랜드가 뷰포트에 남음(헤더 높이만큼 top 오프셋) */}
      <aside className="dashboard-sidebar sticky top-[5.25rem] z-[5] w-full max-h-[calc(100dvh-6rem)] shrink-0 self-start overflow-y-auto border-b border-white/8 bg-sidebar p-4 backdrop-blur-sm md:w-56 md:border-b-0 md:border-r md:border-white/8">
        <DashboardNav />
        <div className="mt-6 flex items-start gap-2 rounded-full border border-white/10 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <UserRound
            className="mt-0.5 size-4 shrink-0 text-primary/80"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <span className="block truncate text-[15px] uppercase tracking-wide">
              로그인
            </span>
            <span className="font-medium text-foreground">{userEmail ?? "—"}</span>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
});
