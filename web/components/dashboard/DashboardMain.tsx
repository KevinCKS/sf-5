"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  PanelState,
  type DashboardPanelState,
} from "@/components/dashboard/PanelState";
import { SensorDashboard } from "@/components/dashboard/SensorDashboard";

type DashboardMainProps = {
  /** 로그인 사용자 이메일(상단 표시) */
  userEmail: string | null;
};

/** 메인 대시보드 — Sensor(실데이터) / Actuator(자리·개발용 ui 쿼리) */
export function DashboardMain({ userEmail }: DashboardMainProps) {
  const searchParams = useSearchParams();

  /** Actuator 패널만 URL ?ui= 로 개발용 상태 전환 (Sensor 는 API 연동) */
  const actuatorPanelState: DashboardPanelState = useMemo(() => {
    const raw = searchParams.get("ui");
    if (raw === "loading" || raw === "empty" || raw === "error") return raw;
    return "empty";
  }, [searchParams]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <p className="text-sm text-muted-foreground">
        로그인:{" "}
        <span className="font-medium text-foreground">
          {userEmail ?? "—"}
        </span>
      </p>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="min-w-0 lg:col-span-1">
          <SensorDashboard />
        </div>
        <div className="min-w-0 lg:col-span-1">
          <PanelState
            title="Actuator"
            description="LED·펌프·팬 제어가 이 영역에 표시됩니다."
            state={actuatorPanelState}
            emptyMessage="제어 채널이 없습니다. 설정 후 버튼이 표시됩니다."
            errorMessage="제어 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
          />
        </div>
      </div>

      {process.env.NODE_ENV === "development" ? (
        <p className="text-center text-xs text-muted-foreground">
          Actuator 개발용 UI:{" "}
          <code className="rounded bg-muted px-1">?ui=loading</code> ·{" "}
          <code className="rounded bg-muted px-1">empty</code> ·{" "}
          <code className="rounded bg-muted px-1">error</code>
        </p>
      ) : null}
    </div>
  );
}
