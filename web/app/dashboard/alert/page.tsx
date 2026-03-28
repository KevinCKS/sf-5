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

const AlertPanel = dynamic(
  () =>
    import("@/components/dashboard/AlertPanel").then((m) => m.AlertPanel),
  { loading: () => <AlertPanelSkeleton /> },
);

/** Alert 탭 — 임계치·알림 이력 (PRD §5.5–5.6) */
export default function DashboardAlertPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <AlertPanel />
    </div>
  );
}
