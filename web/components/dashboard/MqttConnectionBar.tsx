"use client";

import { Button } from "@/components/ui/button";
import { useMqttBrowser } from "@/components/dashboard/MqttBrowserBridgeContext";

/** 대시보드 상단 — MQTT 연결/끊기·상태·힌트 (센서/액추 카드 밖) */
export function MqttConnectionBar() {
  const { status, hint, connect, disconnect } = useMqttBrowser();

  return (
    <div className="bg-muted/15 space-y-2 rounded-lg border px-3 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          브라우저 MQTT
        </span>
        {status !== "live" ? (
          <Button type="button" size="sm" variant="secondary" onClick={connect}>
            {status === "connecting" ? "연결 중…" : "MQTT 연결"}
          </Button>
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={disconnect}>
            연결 끊기
          </Button>
        )}
        <span className="text-muted-foreground text-xs">
          상태:{" "}
          {status === "idle" && "대기"}
          {status === "connecting" && "연결 중"}
          {status === "live" && "구독 중"}
          {status === "error" && "오류"}
        </span>
      </div>
      {hint ? <p className="text-xs text-foreground/90">{hint}</p> : null}
    </div>
  );
}
