"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import mqtt from "mqtt";
import type { MqttClient } from "mqtt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  isActuatorStatusTopic,
  MQTT_STATUS_SUBSCRIBE_PATTERN,
  MQTT_TOPICS,
} from "@/lib/mqtt/allowlist";
import {
  clearBrowserMqttSettings,
  getEnvDefaultMqttForm,
  getInitialMqttForm,
  resolveConnectPassword,
  saveBrowserMqttSettings,
  type BrowserMqttSettings,
} from "@/lib/mqtt/browserMqttSettings";
import { parseResponseBodyJson } from "@/lib/http/parseResponseBodyJson";

/** MQTT 본문을 객체로 파싱한 뒤 timestamp 를 브라우저 시각(ISO UTC)으로 덮어써 ingest 규약을 맞춤 */
function withBrowserTimestamp(raw: string): string | null {
  let o: unknown;
  try {
    o = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (o === null || typeof o !== "object" || Array.isArray(o)) return null;
  const rec = o as Record<string, unknown>;
  rec.timestamp = new Date().toISOString();
  return JSON.stringify(rec);
}

type MqttBrowserBridgeProps = {
  /** 수신 후 DB 저장 성공 시 차트 새로고침 */
  onStored?: () => void;
  /** smartfarm/sensors 구독 성공 시 (예: 조회 방식을 실시간으로 전환) */
  onSubscribed?: () => void;
};

/**
 * 브라우저 MQTT — 연결 설정 UI + 구독 → POST /api/sensors/ingest
 * 기본값은 NEXT_PUBLIC_MQTT_* , 브라우저 저장 시 localStorage(단말 전용)
 */
export function MqttBrowserBridge({
  onStored,
  onSubscribed,
}: MqttBrowserBridgeProps) {
  const [form, setForm] = useState<BrowserMqttSettings>(() =>
    getEnvDefaultMqttForm(),
  );
  useEffect(() => {
    setForm(getInitialMqttForm());
  }, []);

  const clientRef = useRef<MqttClient | null>(null);
  const subscribeTopicRef = useRef<string>(MQTT_TOPICS.sensors);
  const onStoredRef = useRef(onStored);
  onStoredRef.current = onStored;
  const onSubscribedRef = useRef(onSubscribed);
  onSubscribedRef.current = onSubscribed;

  const [status, setStatus] = useState<
    "idle" | "connecting" | "live" | "error"
  >("idle");
  const [hint, setHint] = useState<string | null>(null);

  const disconnect = useCallback(() => {
    try {
      clientRef.current?.end(true);
    } catch {
      /* ignore */
    }
    clientRef.current = null;
    setStatus("idle");
  }, []);

  const connect = useCallback(() => {
    const url = form.brokerUrl.trim();
    if (!url) {
      setHint("브로커 URL(WebSocket, 예: wss://xxx.hivemq.cloud:8884/mqtt)을 입력하세요.");
      setStatus("error");
      return;
    }
    const username =
      form.username.trim() !== ""
        ? form.username.trim()
        : (process.env.NEXT_PUBLIC_MQTT_USERNAME ?? "");
    const password = resolveConnectPassword(form.password);
    const topic = form.sensorTopic.trim() || MQTT_TOPICS.sensors;

    setHint(null);
    setStatus("connecting");
    subscribeTopicRef.current = topic;

    const c = mqtt.connect(url, {
      username,
      password,
      reconnectPeriod: 0,
      connectTimeout: 15_000,
    });
    clientRef.current = c;

    c.on("connect", () => {
      setStatus("live");
      c.subscribe(
        [topic, MQTT_STATUS_SUBSCRIBE_PATTERN],
        { qos: 0 },
        (err) => {
          if (err) {
            setStatus("error");
            setHint(err.message);
          } else {
            onSubscribedRef.current?.();
          }
        },
      );
    });

    c.on("message", async (recvTopic, buf) => {
      const raw = buf.toString("utf8");

      if (recvTopic === subscribeTopicRef.current) {
        const payload = withBrowserTimestamp(raw);
        if (payload === null) {
          setHint("센서 JSON 파싱 실패 또는 객체가 아닙니다.");
          return;
        }
        try {
          const res = await fetch("/api/sensors/ingest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: payload,
          });
          const parsed = await parseResponseBodyJson<{
            inserted?: number;
            error?: string;
          }>(res);
          if (!parsed.parseOk) {
            setHint(parsed.fallbackMessage);
            return;
          }
          const json = parsed.data;
          if (res.ok) {
            setHint(`저장 ${json.inserted ?? 0}건`);
            onStoredRef.current?.();
          } else {
            setHint(json.error ?? `HTTP ${res.status}`);
          }
        } catch (e) {
          setHint(e instanceof Error ? e.message : "요청 실패");
        }
        return;
      }

      if (isActuatorStatusTopic(recvTopic)) {
        let payloadObj: unknown;
        try {
          payloadObj = JSON.parse(raw) as unknown;
        } catch {
          setHint("§6.3 상태 JSON 파싱 실패");
          return;
        }
        try {
          const res = await fetch("/api/actuators/status/ingest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              topic: recvTopic,
              payload: payloadObj,
            }),
          });
          const parsed = await parseResponseBodyJson<{
            ok?: boolean;
            error?: string;
            actuator_key?: string;
          }>(res);
          if (!parsed.parseOk) {
            setHint(parsed.fallbackMessage);
            return;
          }
          const json = parsed.data;
          if (res.ok) {
            setHint(
              `상태 저장 ${json.actuator_key ?? recvTopic}(PRD §6.3)`,
            );
            window.dispatchEvent(
              new CustomEvent("smartfarm-actuator-status-stored"),
            );
          } else {
            setHint(json.error ?? `HTTP ${res.status}`);
          }
        } catch (e) {
          setHint(e instanceof Error ? e.message : "요청 실패");
        }
        return;
      }
    });

    c.on("error", (err) => {
      setStatus("error");
      setHint(err.message);
    });
  }, [form]);

  useEffect(() => {
    return () => {
      try {
        clientRef.current?.end(true);
      } catch {
        /* ignore */
      }
      clientRef.current = null;
    };
  }, []);

  function handleSaveSettings() {
    saveBrowserMqttSettings(form);
    setHint("이 브라우저에 저장했습니다. 변경 적용을 위해 연결 끊기 후 다시 연결하세요.");
    if (status === "live") disconnect();
  }

  function handleClearSettings() {
    clearBrowserMqttSettings();
    setForm(getEnvDefaultMqttForm());
    setHint("저장값을 지웠습니다. env 기본값을 쓰려면 연결을 다시 시도하세요.");
    if (status === "live") disconnect();
  }

  return (
    <div className="bg-muted/20 space-y-3 rounded-md border border-dashed px-3 py-2 text-sm">
      <div className="font-medium">브라우저 MQTT → 로그인 계정 DB 저장</div>
      <p className="text-muted-foreground text-xs leading-relaxed">
        연결 시 <code className="rounded bg-muted px-0.5">smartfarm/sensors</code> 와{" "}
        <code className="rounded bg-muted px-0.5">smartfarm/actuators/status/#</code>(§6.3) 를 함께
        구독합니다. 센서 수신 시 <code className="rounded bg-muted px-0.5">timestamp</code> 는 브라우저
        시각(ISO UTC)으로 넣습니다. 아래 값은 이 브라우저 <strong>localStorage</strong>에만 저장됩니다.
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
              PRD §6.1·allowlist 고정. 액추 <strong>상태</strong>는 §6.3 와일드카드로 자동 구독됩니다.
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

      <div className="flex flex-wrap items-center gap-2">
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
