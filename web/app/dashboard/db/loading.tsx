import { Skeleton } from "@/components/ui/skeleton";

/** DB 탭 전환 시 즉시 표시되는 스켈레톤 */
export default function DashboardDbLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-40" />
        </div>
        <Skeleton className="min-h-[240px] w-full rounded-lg" />
      </div>
      <Skeleton className="min-h-[160px] w-full rounded-lg" />
    </div>
  );
}
