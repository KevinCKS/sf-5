"use client";

import { useCallback, useState, memo } from "react";
import { createPortal } from "react-dom";
import { Loader2, SlidersHorizontal, Wifi, WifiOff, X } from "lucide-react";
import {
  MqttBrowserSettingsBody,
  MqttBrowserSettingsActions,
} from "@/components/dashboard/MqttBrowserSettings";
import { MqttConnectionBar } from "@/components/dashboard/MqttConnectionBar";
import { useMqttConnectionCore } from "@/components/dashboard/MqttBrowserBridgeContext";
import { cn } from "@/lib/utils";

type DashboardMqttCollapsibleProps = {
  /** header: 상단 바 가로 배치(로그아웃 옆) — sidebar: 예전 우측 열 세로 스택 */
  variant?: "sidebar" | "header";
};

/** MQTT 연결 상태 필(클릭 시 연결/끊기) + 토픽 설정 필(다이얼로그) */
export const DashboardMqttCollapsible = memo(function DashboardMqttCollapsible({
  variant = "sidebar",
}: DashboardMqttCollapsibleProps) {
  const isHeader = variant === "header";
  const [open, setOpen] = useState(false);
  const openPanel = useCallback(() => setOpen(true), []);
  const closePanel = useCallback(() => setOpen(false), []);

  const { status, connect, disconnect } = useMqttConnectionCore();

  const onStatusClick = useCallback(() => {
    if (status === "connecting") return;
    if (status === "live") disconnect();
    else connect();
  }, [status, connect, disconnect]);

  return (
    <div className="relative">
      <div
        className={cn(
          "flex gap-2.5",
          isHeader
            ? "w-auto flex-row flex-wrap items-center justify-end"
            : "w-full flex-col",
          open &&
            "pointer-events-none invisible absolute h-0 w-0 overflow-hidden opacity-0",
        )}
        aria-hidden={open}
      >
        {/* 상태 + 연결 토글 — 참조 UI: 주황 테두리·점(끊김) / 연결 시 녹색 */}
        <button
          type="button"
          onClick={onStatusClick}
          disabled={status === "connecting"}
          className={cn(
            "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border-2 px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-wait",
            isHeader ? "w-auto max-w-full shrink-0" : "w-full",
            status === "connecting" && "opacity-90",
            status === "live"
              ? "border-emerald-400/85 bg-emerald-950/25 text-emerald-50 shadow-[0_0_12px_rgba(52,211,153,0.25)]"
              : "border-amber-500/90 bg-transparent text-amber-50/95 shadow-[0_0_10px_rgba(245,158,11,0.15)]",
          )}
        >
          {status === "connecting" ? (
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
          ) : status === "live" ? (
            <Wifi className="size-4 shrink-0 opacity-95" aria-hidden />
          ) : (
            <WifiOff className="size-4 shrink-0 opacity-95" aria-hidden />
          )}
          <span
            className={cn(
              "size-2 shrink-0 rounded-full",
              status === "live"
                ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
                : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.85)]",
            )}
            aria-hidden
          />
          {status === "connecting"
            ? "연결 중…"
            : status === "live"
              ? "MQTT Connected"
              : "MQTT Disconnected"}
        </button>

        {/* MQTT 토픽 설정 — 민트 배경·짙은 글자(참조 UI) */}
        <button
          type="button"
          onClick={openPanel}
          className={cn(
            "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-[0_0_18px_-6px_var(--primary)] transition-opacity hover:opacity-95",
            isHeader ? "w-auto max-w-full shrink-0" : "w-full",
          )}
          aria-expanded={open}
          aria-controls="mqtt-settings-panel"
        >
          <SlidersHorizontal className="size-4 shrink-0 opacity-90" aria-hidden />
          MQTT 토픽 설정
        </button>
      </div>

      {open && typeof document !== "undefined"
        ? createPortal(
            <>
              {/*
                헤더에 backdrop-blur 가 있으면 fixed 가 뷰포트가 아니라 헤더 박스 기준으로 잡혀
                패널이 잘림 → body 로 포털해 escape
              */}
              <div
                className="fixed inset-0 z-40 bg-background/50 backdrop-blur-[2px]"
                onClick={closePanel}
                aria-hidden
              />
              <div
                id="mqtt-settings-panel"
                className="fixed bottom-4 right-4 top-[4.25rem] z-50 flex w-[min(22rem,calc(100vw-2rem))] min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-card text-sm text-card-foreground shadow-2xl sm:w-80 sm:max-w-[min(20rem,calc(100vw-3rem))]"
                role="dialog"
                aria-modal="true"
                aria-labelledby="mqtt-settings-title"
              >
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5">
                  <h2
                    id="mqtt-settings-title"
                    className="flex items-center gap-2 text-sm font-semibold tracking-tight"
                  >
                    <SlidersHorizontal
                      className="size-4 shrink-0 text-primary"
                      aria-hidden
                    />
                    MQTT 토픽 설정
                  </h2>
                  <button
                    type="button"
                    className="text-muted-foreground hover:bg-muted/60 hover:text-foreground inline-flex size-8 items-center justify-center rounded-md transition-colors"
                    onClick={closePanel}
                    aria-label="MQTT 토픽 설정 닫기"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="min-h-0 flex-1 basis-0 overflow-y-auto overscroll-contain px-3 pt-3 [scrollbar-gutter:stable]">
                  <div className="space-y-4 pb-3">
                    <MqttBrowserSettingsBody />
                    <MqttConnectionBar />
                  </div>
                </div>
                <div className="shrink-0 border-t border-white/10 bg-card/95 px-3 pb-3 pt-2 backdrop-blur-sm">
                  <MqttBrowserSettingsActions onRequestClose={closePanel} />
                </div>
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
});
