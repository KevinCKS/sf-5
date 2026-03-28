"use client";

import { Button } from "@/components/ui/button";
import { useMqttBrowser } from "@/components/dashboard/MqttBrowserBridgeContext";
import { cn } from "@/lib/utils";

/** 대시보드 — MQTT 연결/끊기·상태(구독 중 시 네온·입체 스타일) */
export function MqttConnectionBar() {
  const { status, hint, connect, disconnect } = useMqttBrowser();

  return (
    <div className="space-y-2 rounded-xl border border-cyan-500/15 bg-muted/30 px-3 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {status !== "live" ? (
          <Button type="button" size="sm" variant="secondary" onClick={connect}>
            {status === "connecting" ? "연결 중…" : "MQTT 연결"}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={disconnect}
            className={cn(
              "border-2 border-cyan-400/55 bg-gradient-to-b from-slate-900/95 via-slate-950/98 to-slate-950 text-cyan-100",
              "shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_14px_rgba(34,211,238,0.45),0_0_28px_rgba(6,182,212,0.25),0_2px_0_rgba(0,0,0,0.4)]",
              "[text-shadow:0_0_10px_rgba(103,232,249,0.45)]",
              "transition-[box-shadow,border-color,transform] duration-200",
              "hover:border-cyan-300/75 hover:bg-cyan-950/35 hover:text-cyan-50 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_0_22px_rgba(34,211,238,0.55),0_0_36px_rgba(34,211,238,0.2)]",
              "active:translate-y-px",
            )}
          >
            연결 끊기
          </Button>
        )}
        <span
          className={cn(
            "inline-flex items-center gap-1 text-xs",
            status === "live"
              ? "rounded-full border-2 border-cyan-300/50 bg-gradient-to-b from-cyan-500/35 via-cyan-600/25 to-indigo-950/50 px-3 py-1.5 font-semibold tracking-tight text-cyan-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_0_16px_rgba(34,211,238,0.55),0_0_28px_rgba(6,182,212,0.3),0_2px_0_rgba(0,0,0,0.35)] [text-shadow:0_0_14px_rgba(165,243,252,0.85),0_0_2px_rgba(34,211,238,0.9)] ring-1 ring-cyan-400/30"
              : "text-muted-foreground",
          )}
        >
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
