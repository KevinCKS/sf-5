"use client";

import { ActuatorPanel } from "@/components/dashboard/ActuatorPanel";
import { DashboardMqttCollapsible } from "@/components/dashboard/DashboardMqttCollapsible";
import { SensorDashboard } from "@/components/dashboard/SensorDashboard";

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
