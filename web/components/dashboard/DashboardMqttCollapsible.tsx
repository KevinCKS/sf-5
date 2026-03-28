"use client";

import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { MqttBrowserSettings } from "@/components/dashboard/MqttBrowserSettings";
import { MqttConnectionBar } from "@/components/dashboard/MqttConnectionBar";
import { cn } from "@/lib/utils";

/** 대시보드 우측 — MQTT 설정(접힘 시 한 줄 칩, 펼침 시 다른 카드 위 오버레이) */
export function DashboardMqttCollapsible() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      {/* 접힘: xl에서는 글자+아이콘을 카드 안에서 가운데 정렬(양쪽 여백 균형) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "dashboard-surface flex w-full items-center justify-between gap-2 px-3 py-3 text-left text-sm font-medium transition-opacity duration-200",
          "xl:justify-center xl:gap-2 xl:px-3 xl:py-[0.55rem] xl:text-center",
          open &&
            "pointer-events-none invisible absolute h-0 w-0 overflow-hidden opacity-0",
        )}
        aria-expanded={open}
        aria-controls="mqtt-settings-panel"
        aria-hidden={open}
      >
        <span className="min-w-0 flex-1 truncate leading-tight xl:flex-initial xl:whitespace-nowrap xl:font-semibold xl:leading-none">
          MQTT 설정
        </span>
        <ChevronDown
          className="text-muted-foreground h-4 w-4 shrink-0"
          aria-hidden
        />
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-background/50 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            id="mqtt-settings-panel"
            className={cn(
              "dashboard-panel-dialog fixed right-4 top-[4.25rem] z-50 flex max-h-[min(85vh,calc(100dvh-5rem))] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-cyan-400/20 bg-card text-card-foreground shadow-2xl",
              "xl:absolute xl:right-0 xl:top-0 xl:mt-0 xl:w-80 xl:max-w-[min(20rem,calc(100vw-3rem))]",
            )}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mqtt-settings-title"
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-cyan-500/15 px-3 py-2.5">
              <h2
                id="mqtt-settings-title"
                className="text-sm font-semibold tracking-tight"
              >
                MQTT 설정
              </h2>
              <button
                type="button"
                className="text-muted-foreground hover:bg-muted/60 hover:text-foreground inline-flex size-8 items-center justify-center rounded-md transition-colors"
                onClick={() => setOpen(false)}
                aria-label="MQTT 설정 닫기"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-3">
              <MqttBrowserSettings />
              <MqttConnectionBar />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
