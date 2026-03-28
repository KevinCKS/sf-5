import { Skeleton } from "@/components/ui/skeleton";

/** 대시보드 라우트 로딩 — 초기 진입 시 스켈레톤 */
export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <Skeleton className="h-5 w-56" />
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="min-h-[200px] rounded-lg" />
        <Skeleton className="min-h-[200px] rounded-lg" />
      </div>
    </div>
  );
}
