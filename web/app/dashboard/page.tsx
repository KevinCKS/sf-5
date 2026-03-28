import { Suspense } from "react";
import { DashboardHomeContent } from "@/components/dashboard/DashboardHomeContent";
import { Skeleton } from "@/components/ui/skeleton";

/** 대시보드 탭 — 레이아웃에서 인증 처리 */
export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardPageSkeleton />}>
      <DashboardHomeContent />
    </Suspense>
  );
}

function DashboardPageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-40 w-full max-w-md rounded-lg" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}
