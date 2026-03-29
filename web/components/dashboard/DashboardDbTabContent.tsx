"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/** DB 상단 패널 청크 분리 — 탭 전환 시 파싱량 감소 */
function DbSensorPanelSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <Skeleton className="h-8 w-48" />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-40" />
      </div>
      <Skeleton className="min-h-[240px] w-full rounded-lg" />
    </div>
  );
}

// ssr: false — 서버 page 에서는 불가하므로 클라이언트 래퍼에서만 적용
const SensorReadingsDbPanel = dynamic(
  () =>
    import("@/components/dashboard/SensorReadingsDbPanel").then(
      (m) => m.SensorReadingsDbPanel,
    ),
  { loading: () => <DbSensorPanelSkeleton />, ssr: false },
);

/** 액추 이력 패널 청크 분리 */
function DbActuatorPanelSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <Skeleton className="h-8 w-44" />
      <Skeleton className="min-h-[120px] w-full rounded-lg" />
    </div>
  );
}

const ActuatorPanel = dynamic(
  () =>
    import("@/components/dashboard/ActuatorPanel").then((m) => m.ActuatorPanel),
  { loading: () => <DbActuatorPanelSkeleton />, ssr: false },
);

/** DB 탭 본문 — 센서 조회 + 액추 이력 */
export function DashboardDbTabContent() {
  return (
    <>
      <SensorReadingsDbPanel />
      <ActuatorPanel showMqttDetails={false} showControls={false} showHistory />
    </>
  );
}
