"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useMqttConnectionCore,
  useMqttForm,
} from "@/components/dashboard/MqttBrowserBridgeContext";
import { ACTUATOR_ROWS } from "@/lib/mqtt/actuatorTopics";
import { MQTT_TOPICS } from "@/lib/mqtt/allowlist";
import type { BrowserMqttSettings } from "@/lib/mqtt/browserMqttSettings";
import { Braces, Radio, Save, Send, Server } from "lucide-react";
import { cn } from "@/lib/utils";

/** 섹션별 입체 카드 — 위쪽 하이라이트 + 바닥 그림자로 단계 구분 */
const mqttSectionCard =
  "group space-y-2 rounded-xl border border-white/[0.12] bg-gradient-to-b from-card via-card to-muted/35 px-3 py-3 text-xs shadow-[0_1px_0_0_rgba(255,255,255,0.07)_inset,0_6px_20px_-8px_rgba(0,0,0,0.55),0_2px_8px_-4px_rgba(0,0,0,0.35)] ring-1 ring-black/25";

/** 저장/환경변수 줄 — 동일 톤의 얕은 받침대 */
const mqttActionsCard =
  "flex flex-wrap justify-center gap-4 rounded-xl border border-white/[0.1] bg-gradient-to-b from-muted/50 to-muted/25 px-3 py-3 shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,0_4px_16px_-6px_rgba(0,0,0,0.45)] ring-1 ring-black/20";

/** 폼 본문만 — 다이얼로그에서는 푸터와 분리해 스크롤 영역에만 넣기 위함 */
export function MqttBrowserSettingsBody() {
  const { form, setForm } = useMqttForm();

  return (
    <div className="space-y-4 text-sm">
      <details className={cn(mqttSectionCard)}>
        <summary className="cursor-pointer list-none font-semibold text-foreground [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-[10px] font-bold text-primary ring-1 ring-primary/30">
              1
            </span>
            <Server className="size-3.5 shrink-0 text-primary/85" aria-hidden />
            MQTT Broker
          </span>
        </summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="mqtt-broker-url">브로커 WebSocket URL</Label>
            <Input
              id="mqtt-broker-url"
              type="url"
              autoComplete="off"
              placeholder="wss://…"
              value={form.brokerUrl}
              onChange={(e) =>
                setForm((f) => ({ ...f, brokerUrl: e.target.value }))
              }
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="mqtt-user">사용자명</Label>
            <Input
              id="mqtt-user"
              autoComplete="off"
              value={form.username}
              onChange={(e) =>
                setForm((f) => ({ ...f, username: e.target.value }))
              }
              className="text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="mqtt-pass">비밀번호</Label>
            <Input
              id="mqtt-pass"
              type="password"
              autoComplete="off"
              placeholder="비우면 .env 의 NEXT_PUBLIC_MQTT_PASSWORD"
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value }))
              }
              className="text-xs"
            />
          </div>
        </div>
      </details>

      <details className={cn(mqttSectionCard)}>
        <summary className="cursor-pointer list-none font-semibold text-foreground [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-[10px] font-bold text-primary ring-1 ring-primary/30">
              2
            </span>
            <Radio className="size-3.5 shrink-0 text-primary/85" aria-hidden />
            Sensor Subscribe Topic
          </span>
        </summary>
        <div className="mt-2 space-y-1">
          <Label htmlFor="mqtt-topic">센서 구독 토픽</Label>
          <Input
            id="mqtt-topic"
            readOnly
            value={form.sensorTopic}
            className="bg-muted/50 font-mono text-xs"
          />
          <p className="text-muted-foreground">
            PRD §6.1·allowlist 고정 ({MQTT_TOPICS.sensors}).
          </p>
        </div>
      </details>

      <details className={cn(mqttSectionCard)}>
        <summary className="cursor-pointer list-none font-semibold text-foreground [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-[10px] font-bold text-primary ring-1 ring-primary/30">
              3
            </span>
            <Send className="size-3.5 shrink-0 text-primary/85" aria-hidden />
            Actuator Publish Topic
          </span>
        </summary>
        <div className="mt-2 space-y-4">
          <div>
            <div className="text-foreground font-medium">명령 발행 토픽</div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              서버 allowlist·해당 액추 키와 일치할 때만 유지됩니다.
            </p>
            <div className="mt-2 grid gap-2">
              {ACTUATOR_ROWS.map((row) => (
                <div
                  key={row.key}
                  className="grid gap-1 sm:grid-cols-[6rem_1fr] sm:items-center"
                >
                  <Label
                    htmlFor={`mqtt-cmd-${row.key}`}
                    className="text-[11px] sm:pt-0"
                  >
                    {row.label}
                  </Label>
                  <Input
                    id={`mqtt-cmd-${row.key}`}
                    autoComplete="off"
                    value={form.actuatorCommandTopics[row.key]}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        actuatorCommandTopics: {
                          ...f.actuatorCommandTopics,
                          [row.key]: e.target.value,
                        } satisfies BrowserMqttSettings["actuatorCommandTopics"],
                      }))
                    }
                    className="font-mono text-xs"
                  />
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-foreground font-medium">상태 구독 토픽</div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              비우거나 잘못된 값은 저장 시 PRD 기본으로 맞춥니다.
            </p>
            <div className="mt-2 grid gap-2">
              {ACTUATOR_ROWS.map((row) => (
                <div
                  key={row.key}
                  className="grid gap-1 sm:grid-cols-[6rem_1fr] sm:items-center"
                >
                  <Label
                    htmlFor={`mqtt-st-${row.key}`}
                    className="text-[11px] sm:pt-0"
                  >
                    {row.label}
                  </Label>
                  <Input
                    id={`mqtt-st-${row.key}`}
                    autoComplete="off"
                    value={form.actuatorStatusSubscribeTopics[row.key]}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        actuatorStatusSubscribeTopics: {
                          ...f.actuatorStatusSubscribeTopics,
                          [row.key]: e.target.value,
                        } satisfies BrowserMqttSettings["actuatorStatusSubscribeTopics"],
                      }))
                    }
                    className="font-mono text-xs"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}

type MqttBrowserSettingsActionsProps = {
  /** 헤더 다이얼로그 등에서 저장·env 적용 후 패널 닫기 */
  onRequestClose?: () => void;
};

/** 저장·환경변수 — 다이얼로그 하단 고정 푸터에 두면 긴 폼을 펼쳐도 항상 보임 */
export function MqttBrowserSettingsActions({
  onRequestClose,
}: MqttBrowserSettingsActionsProps = {}) {
  const { handleSaveSettings, handleClearSettings } = useMqttConnectionCore();

  return (
    <div className={cn(mqttActionsCard, "w-full pt-1")}>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => {
          handleSaveSettings();
          onRequestClose?.();
        }}
      >
        <Save className="mr-1.5 size-3.5 shrink-0" aria-hidden />
        저장
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          handleClearSettings();
          onRequestClose?.();
        }}
      >
        <Braces className="mr-1.5 size-3.5 shrink-0" aria-hidden />
        환경변수
      </Button>
    </div>
  );
}

/** 센서 탭 등 — 본문+버튼 한 덩어리 */
export function MqttBrowserSettings() {
  return (
    <div className="space-y-4 text-sm">
      <MqttBrowserSettingsBody />
      <MqttBrowserSettingsActions />
    </div>
  );
}
