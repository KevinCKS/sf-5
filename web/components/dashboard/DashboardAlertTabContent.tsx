"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

function AlertPanelSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="min-h-[120px] w-full rounded-lg" />
      <Skeleton className="min-h-[200px] w-full rounded-lg" />
    </div>
  );
}

// ssr: false — 서버 page 에서는 불가하므로 클라이언트 래퍼에서만 적용
const AlertPanel = dynamic(
  () =>
    import("@/components/dashboard/AlertPanel").then((m) => m.AlertPanel),
  { loading: () => <AlertPanelSkeleton />, ssr: false },
);

/** Alert 탭 본문 — dynamic + ssr:false 로 서버 RSC 부담 감소 */
export function DashboardAlertTabContent() {
  return <AlertPanel />;
}
