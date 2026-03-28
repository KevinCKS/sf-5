"use client";

import { ActuatorPanel } from "@/components/dashboard/ActuatorPanel";
import {
  MqttBrowserProvider,
  MqttConnectionBar,
} from "@/components/dashboard/MqttBrowserBridge";
import { SensorDashboard } from "@/components/dashboard/SensorDashboard";

type DashboardMainProps = {
  /** 로그인 사용자 이메일(상단 표시) */
  userEmail: string | null;
};

/** 메인 대시보드 — Sensor / Actuator(MQTT 발행·이력) */
export function DashboardMain({ userEmail }: DashboardMainProps) {
  return (
    <MqttBrowserProvider>
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        <p className="text-sm text-muted-foreground">
          로그인:{" "}
          <span className="font-medium text-foreground">
            {userEmail ?? "—"}
          </span>
        </p>

        <MqttConnectionBar />

        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <div className="min-w-0 lg:col-span-1">
            <SensorDashboard />
          </div>
          <div className="min-w-0 lg:col-span-1">
            <ActuatorPanel />
          </div>
        </div>
      </div>
    </MqttBrowserProvider>
  );
}
