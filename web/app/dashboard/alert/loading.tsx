import { Skeleton } from "@/components/ui/skeleton";

/** Alert 탭 전환 시 즉시 표시되는 스켈레톤 */
export default function DashboardAlertLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="min-h-[120px] w-full rounded-lg" />
      <Skeleton className="min-h-[200px] w-full rounded-lg" />
    </div>
  );
}
