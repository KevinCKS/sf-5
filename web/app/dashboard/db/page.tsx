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

const SensorReadingsDbPanel = dynamic(
  () =>
    import("@/components/dashboard/SensorReadingsDbPanel").then(
      (m) => m.SensorReadingsDbPanel,
    ),
  { loading: () => <DbSensorPanelSkeleton /> },
);

/** 액추 이력 패널 청크 분리 — DB 탭 초기 JS 부담 완화 */
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
  { loading: () => <DbActuatorPanelSkeleton /> },
);

/** DB 탭 — 센서 측정값 조회(기간·타입·정렬) + 액추 제어 이력(MQTT 설정은 대시보드 탭) */
export default function DashboardDbPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <SensorReadingsDbPanel />
      <ActuatorPanel showMqttDetails={false} showControls={false} showHistory />
    </div>
  );
}
