"use client";

import { DashboardMqttCollapsible } from "@/components/dashboard/DashboardMqttCollapsible";
import { LogoutButton } from "./LogoutButton";

/** 헤더 우측 — MQTT 연결·토픽 설정 + 로그아웃(본문 카드 가로 공간 확보) */
export function DashboardHeaderActions() {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
      <DashboardMqttCollapsible variant="header" />
      <LogoutButton />
    </div>
  );
}
