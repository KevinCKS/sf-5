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

/** MQTT 접힘 UI 청크 분리 — 차트·액추와 동시 파싱 부담 완화 */
function MqttAsideSkeleton() {
  return (
    <div className="dashboard-surface h-12 w-full rounded-lg md:max-w-xl xl:max-w-none" aria-hidden>
      <Skeleton className="h-full w-full rounded-lg opacity-60" />
    </div>
  );
}

const DashboardMqttCollapsible = dynamic(
  () =>
    import("@/components/dashboard/DashboardMqttCollapsible").then(
      (m) => m.DashboardMqttCollapsible,
    ),
  { loading: () => <MqttAsideSkeleton />, ssr: false },
);

/** 대시보드 탭 — 센서·액추는 넓게, MQTT는 xl에서 화면 오른쪽 고정(카드 zoom 1.3 반영해 열 너비 ~15rem) */
export function DashboardHomeContent() {
  return (
    <div className="mx-auto w-full max-w-6xl xl:pr-[15rem]">
      <div className="space-y-6">
        <SensorDashboard hideMqttSettings hideClearReadings />
        <ActuatorPanel showMqttDetails={false} showHistory={false} />
      </div>
      {/* xl: 뷰포트 우측 고정(플로우 밖) → 좌측 카드가 가로 전체 사용 */}
      <aside
        className="relative z-30 mt-6 w-full xl:fixed xl:top-28 xl:right-0 xl:mt-0 xl:w-[15rem] xl:min-w-[15rem] xl:px-0"
        aria-label="MQTT 설정"
      >
        <DashboardMqttCollapsible />
      </aside>
    </div>
  );
}
