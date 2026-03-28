import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardMain } from "@/components/dashboard/DashboardMain";
import { Skeleton } from "@/components/ui/skeleton";

/** 보호된 대시보드(메인) — Sensor / Actuator 구획 및 상태 UI */
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  return (
    <Suspense fallback={<DashboardPageSkeleton />}>
      <DashboardMain userEmail={user.email ?? null} />
    </Suspense>
  );
}

/** searchParams 사용 클라이언트 전 Suspense 폴백 */
function DashboardPageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <Skeleton className="h-5 w-64" />
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    </div>
  );
}
