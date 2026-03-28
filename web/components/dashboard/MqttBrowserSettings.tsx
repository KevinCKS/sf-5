"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMqttBrowser } from "@/components/dashboard/MqttBrowserBridgeContext";
import { ACTUATOR_ROWS } from "@/lib/mqtt/actuatorTopics";
import { MQTT_TOPICS } from "@/lib/mqtt/allowlist";
import type { BrowserMqttSettings } from "@/lib/mqtt/browserMqttSettings";

/** 우측 패널·센서 카드 — 브로커 / 센서 토픽 / 액추 토픽을 접었다 펼칠 수 있게 구분 */
export function MqttBrowserSettings() {
  const { form, setForm, handleSaveSettings, handleClearSettings } =
    useMqttBrowser();

  return (
    <div className="bg-muted/20 space-y-3 rounded-md border border-dashed px-3 py-2 text-sm">
      <div className="font-medium">MQTT 연결 → 로그인 계정 DB 저장</div>
      <p className="text-muted-foreground text-xs leading-relaxed">
        연결 시 센서 토픽과 아래 §6.3 상태 토픽을 함께 구독합니다. 센서 수신 시{" "}
        <code className="rounded bg-muted px-0.5">timestamp</code> 는 브라우저 시각(ISO UTC)으로
        넣습니다. 값은 이 브라우저 <strong>localStorage</strong>에만 저장됩니다.
      </p>

      <details className="group space-y-2 rounded-md border bg-muted/30 px-2 py-2 text-xs">
        <summary className="cursor-pointer select-none font-medium text-foreground">
          1. MQTT Broker
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

      <details className="group space-y-2 rounded-md border bg-muted/30 px-2 py-2 text-xs">
        <summary className="cursor-pointer select-none font-medium text-foreground">
          2. Sensor Subscribe Topic
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

      <details className="group space-y-2 rounded-md border bg-muted/30 px-2 py-2 text-xs">
        <summary className="cursor-pointer select-none font-medium text-foreground">
          3. Actuator Publish Topic
        </summary>
        <div className="mt-2 space-y-4">
          <div>
            <div className="text-foreground font-medium">§6.2 명령 발행</div>
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
            <div className="text-foreground font-medium">§6.3 액추에이터 상태 구독 토픽</div>
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

      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="button" size="sm" variant="secondary" onClick={handleSaveSettings}>
          이 브라우저에 저장
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={handleClearSettings}>
          저장 지우기(env만)
        </Button>
      </div>
    </div>
  );
}
