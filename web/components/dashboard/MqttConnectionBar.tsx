"use client";

import { memo } from "react";
import { Info } from "lucide-react";
import { useMqttHint } from "@/components/dashboard/MqttBrowserBridgeContext";

/** 힌트 한 줄만 별도 구독 — 수신 메시지마다 버튼 쪽 리렌더 생략 */
export const MqttConnectionHintLine = memo(function MqttConnectionHintLine() {
  const { hint } = useMqttHint();
  return hint ? (
    <p className="flex items-start gap-2 text-xs text-foreground/90">
      <Info className="mt-0.5 size-3.5 shrink-0 text-primary/80" aria-hidden />
      <span>{hint}</span>
    </p>
  ) : null;
});

/** 다이얼로그 내부 — 연결/끊기는 우측 고정 필에서만 처리, 힌트 있을 때만 박스 표시 */
export const MqttConnectionBar = memo(function MqttConnectionBar() {
  const { hint } = useMqttHint();
  if (!hint?.trim()) return null;

  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-muted/30 px-3 py-3 text-sm">
      <MqttConnectionHintLine />
    </div>
  );
});
