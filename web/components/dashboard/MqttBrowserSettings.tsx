"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMqttBrowser } from "@/components/dashboard/MqttBrowserBridgeContext";

/** 센서 카드용 — 브로커·계정·센서 토픽·localStorage 저장 (연결 버튼은 상단 MqttConnectionBar) */
export function MqttBrowserSettings() {
  const { form, setForm, handleSaveSettings, handleClearSettings } =
    useMqttBrowser();

  return (
    <div className="bg-muted/20 space-y-3 rounded-md border border-dashed px-3 py-2 text-sm">
      <div className="font-medium">브라우저 MQTT → 로그인 계정 DB 저장</div>
      <p className="text-muted-foreground text-xs leading-relaxed">
        연결 시 센서 토픽과 Actuator 카드(또는 저장된 기본값)의 §6.3 액추별 상태 토픽을 함께
        구독합니다. 센서 수신 시{" "}
        <code className="rounded bg-muted px-0.5">timestamp</code> 는 브라우저 시각(ISO UTC)으로
        넣습니다. 아래 값은 이 브라우저 <strong>localStorage</strong>에만 저장됩니다.
      </p>

      <details className="group space-y-2 rounded-md border bg-muted/30 px-2 py-2 text-xs">
        <summary className="cursor-pointer select-none font-medium text-foreground">
          연결·토픽 설정 (PRD §6.1)
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
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="mqtt-topic">센서 구독 토픽</Label>
            <Input
              id="mqtt-topic"
              readOnly
              value={form.sensorTopic}
              className="bg-muted/50 font-mono text-xs"
            />
            <p className="text-muted-foreground">
              PRD §6.1·allowlist 고정. §6.2·§6.3 액추 토픽은 Actuator 카드에서 설정합니다.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="button" size="sm" variant="secondary" onClick={handleSaveSettings}>
            이 브라우저에 저장
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={handleClearSettings}>
            저장 지우기(env만)
          </Button>
        </div>
      </details>
    </div>
  );
}
