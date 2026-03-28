"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import mqtt from "mqtt";
import type { MqttClient } from "mqtt";
import { Button } from "@/components/ui/button";
import { MQTT_TOPICS } from "@/lib/mqtt/allowlist";
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
};

/**
 * 브라우저에서 HiveMQ(WebSocket) 구독 → 수신 페이로드를 로그인 세션으로 POST /api/sensors/ingest
 * NEXT_PUBLIC_MQTT_* 는 번들에 노출됨 — 프로덕션에서는 제한적 계정·ACL 권장
 */
export function MqttBrowserBridge({ onStored }: MqttBrowserBridgeProps) {
  const wsUrl = process.env.NEXT_PUBLIC_MQTT_BROKER_URL;
  const mqttUser = process.env.NEXT_PUBLIC_MQTT_USERNAME;
  const mqttPass = process.env.NEXT_PUBLIC_MQTT_PASSWORD;

  const clientRef = useRef<MqttClient | null>(null);
  const onStoredRef = useRef(onStored);
  onStoredRef.current = onStored;

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
    if (!wsUrl || mqttUser === undefined) {
      setHint("NEXT_PUBLIC_MQTT_BROKER_URL, NEXT_PUBLIC_MQTT_USERNAME 을 설정하세요.");
      setStatus("error");
      return;
    }
    setHint(null);
    setStatus("connecting");
    const c = mqtt.connect(wsUrl, {
      username: mqttUser,
      password: mqttPass ?? "",
      reconnectPeriod: 0,
      connectTimeout: 15_000,
    });
    clientRef.current = c;

    c.on("connect", () => {
      setStatus("live");
      c.subscribe(MQTT_TOPICS.sensors, { qos: 0 }, (err) => {
        if (err) {
          setStatus("error");
          setHint(err.message);
        }
      });
    });

    c.on("message", async (topic, buf) => {
      if (topic !== MQTT_TOPICS.sensors) return;
      const raw = buf.toString("utf8");
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
    });

    c.on("error", (err) => {
      setStatus("error");
      setHint(err.message);
    });
  }, [wsUrl, mqttUser, mqttPass]);

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

  if (!wsUrl) {
    return (
      <div className="bg-muted/30 text-muted-foreground rounded-md border border-dashed px-3 py-2 text-xs">
        브라우저 MQTT: <code className="rounded bg-muted px-1">NEXT_PUBLIC_MQTT_BROKER_URL</code>{" "}
        등을 설정하면 연결할 수 있습니다. 비밀번호는 클라이언트에 노출됩니다.
      </div>
    );
  }

  return (
    <div className="bg-muted/20 space-y-2 rounded-md border border-dashed px-3 py-2 text-sm">
      <div className="font-medium">브라우저 MQTT → 로그인 계정 DB 저장</div>
      <p className="text-muted-foreground text-xs leading-relaxed">
        탭을 연 동안만 구독합니다. 저장 대상은 <strong>현재 로그인한 사용자</strong>의 센서입니다.
        <code className="rounded bg-muted px-0.5">timestamp</code> 는 수신 시 브라우저 시각(ISO UTC)으로
        넣습니다. 자격 증명은 <code className="rounded bg-muted px-0.5">NEXT_PUBLIC_MQTT_*</code> 로
        노출되므로 프로덕션에서는 브로커 ACL·전용 계정을 권장합니다.
      </p>
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
