"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/** Recharts 청크 분리 — 대시보드 탭 첫 페인트·JS 파싱 부담 완화 */
function SensorChartSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <Skeleton className="h-10 w-full max-w-md" />
      <Skeleton className="h-[min(360px,50vh)] w-full rounded-lg" />
    </div>
  );
}

function ActuatorBlockSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <Skeleton className="h-8 w-44" />
      <Skeleton className="min-h-[140px] w-full rounded-lg" />
    </div>
  );
}

// ssr: false — 클라이언트 전용 패널은 서버 사전 렌더 생략·초기 RSC 부담 감소
const SensorDashboard = dynamic(
  () =>
    import("@/components/dashboard/SensorDashboard").then(
      (m) => m.SensorDashboard,
    ),
  { loading: () => <SensorChartSkeleton />, ssr: false },
);

const ActuatorPanel = dynamic(
  () =>
    import("@/components/dashboard/ActuatorPanel").then((m) => m.ActuatorPanel),
  { loading: () => <ActuatorBlockSkeleton />, ssr: false },
);

/** 대시보드 탭 — lg 이상에서 센서·액추 2열(참조 UI), compact로 한 화면 배치 */
export function DashboardHomeContent() {
  return (
    <div className="dashboard-home-split mx-auto w-full max-w-7xl px-0 sm:px-1 lg:pl-0 lg:pr-5">
      {/* lg: 좌·우 패딩 비대칭·열 간격 확대 / 센서 1.3·액추 0.7fr — 시각적으로 좌·우 살짝 밀기 */}
      {/* lg: 행 높이=max(센서,액추) — 양열 stretch + 패널 h-full 로 카드 박스 높이 동일 */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.3fr_0.7fr] lg:items-stretch lg:gap-x-10 lg:gap-y-6">
        {/* lg: 양열 self-stretch — 행 높이=max(센서,액추) 를 두 패널이 동일하게 채움 */}
        <div className="flex h-full min-h-0 min-w-0 flex-col self-stretch lg:w-full lg:-translate-x-1">
          <SensorDashboard
            hideMqttSettings
            hideClearReadings
            compactHomeLayout
          />
        </div>
        <div className="flex h-full min-h-0 min-w-0 flex-col self-stretch lg:translate-x-2">
          <ActuatorPanel
            showMqttDetails={false}
            showHistory={false}
            compactHome
          />
        </div>
      </div>
    </div>
  );
}
