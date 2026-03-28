"use client";

import type { ReactNode } from "react";
import { DashboardNav } from "@/components/dashboard/DashboardNav";

type DashboardShellProps = {
  children: ReactNode;
  userEmail: string | null;
};

/** 좌측 내비 + 가운데 메인 영역 */
export function DashboardShell({ children, userEmail }: DashboardShellProps) {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col md:flex-row">
      <aside className="dashboard-sidebar shrink-0 border-b border-cyan-500/10 bg-sidebar/90 p-3 backdrop-blur-sm md:w-52 md:border-b-0 md:border-r">
        <DashboardNav />
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-6">
        <p className="text-muted-foreground mb-4 text-sm">
          로그인:{" "}
          <span className="font-medium text-foreground">{userEmail ?? "—"}</span>
        </p>
        {children}
      </main>
    </div>
  );
}
