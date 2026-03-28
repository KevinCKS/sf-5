"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  PanelState,
  type DashboardPanelState,
} from "@/components/dashboard/PanelState";

type DashboardMainProps = {
  /** 로그인 사용자 이메일(상단 표시) */
  userEmail: string | null;
};

/** 메인 대시보드 — Sensor / Actuator 구역 및 공통 상태 UI */
export function DashboardMain({ userEmail }: DashboardMainProps) {
  const searchParams = useSearchParams();

  const panelState: DashboardPanelState = useMemo(() => {
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

      <div className="grid gap-6 md:grid-cols-2">
        <PanelState
          title="Sensor"
          description="온도·습도 등 센서 요약과 차트가 이 영역에 표시됩니다."
          state={panelState}
          emptyMessage="등록된 센서가 없습니다. 연결 후 데이터가 여기에 나타납니다."
          errorMessage="센서 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
        />
        <PanelState
          title="Actuator"
          description="LED·펌프·팬 제어가 이 영역에 표시됩니다."
          state={panelState}
          emptyMessage="제어 채널이 없습니다. 설정 후 버튼이 표시됩니다."
          errorMessage="제어 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
        />
      </div>

      {process.env.NODE_ENV === "development" ? (
        <p className="text-center text-xs text-muted-foreground">
          개발용 UI 전환: URL에{" "}
          <code className="rounded bg-muted px-1">?ui=loading</code> ·{" "}
          <code className="rounded bg-muted px-1">empty</code> ·{" "}
          <code className="rounded bg-muted px-1">error</code>
        </p>
      ) : null}
    </div>
  );
}
