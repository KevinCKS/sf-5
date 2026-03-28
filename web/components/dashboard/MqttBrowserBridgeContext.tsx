"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { MqttClient } from "mqtt";
import { isActuatorStatusTopic, MQTT_TOPICS } from "@/lib/mqtt/allowlist";
import {
  clearBrowserMqttSettings,
  getEnvDefaultMqttForm,
  getInitialMqttForm,
  getSubscribeTopicListFromForm,
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

type MqttCallbacks = {
  onStored?: () => void;
  onSubscribed?: () => void;
};

export type MqttBrowserContextValue = {
  form: BrowserMqttSettings;
  setForm: React.Dispatch<React.SetStateAction<BrowserMqttSettings>>;
  status: "idle" | "connecting" | "live" | "error";
  hint: string | null;
  connect: () => void;
  disconnect: () => void;
  handleSaveSettings: () => void;
  handleClearSettings: () => void;
  /** Sensor 카드 등에서 ingest/구독 콜백 등록 */
  registerCallbacks: (c: MqttCallbacks) => void;
};

const MqttBrowserContext = createContext<MqttBrowserContextValue | null>(null);

/** 브라우저 MQTT 연결·폼 상태 — Sensor/연결 바가 공유 */
export function MqttBrowserProvider({ children }: { children: ReactNode }) {
  const [form, setForm] = useState<BrowserMqttSettings>(() =>
    getEnvDefaultMqttForm(),
  );
  useEffect(() => {
    setForm(getInitialMqttForm());
  }, []);

  const clientRef = useRef<MqttClient | null>(null);
  const subscribeTopicRef = useRef<string>(MQTT_TOPICS.sensors);
  const callbacksRef = useRef<MqttCallbacks>({});

  const registerCallbacks = useCallback((c: MqttCallbacks) => {
    callbacksRef.current = c;
  }, []);

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
      setHint(
        "브로커 URL(WebSocket, 예: wss://xxx.hivemq.cloud:8884/mqtt)을 입력하세요.",
      );
      setStatus("error");
      return;
    }
    const username =
      form.username.trim() !== ""
        ? form.username.trim()
        : (process.env.NEXT_PUBLIC_MQTT_USERNAME ?? "");
    const password = resolveConnectPassword(form.password);
    const topic = form.sensorTopic.trim() || MQTT_TOPICS.sensors;
    const subscribeList = getSubscribeTopicListFromForm(form);

    setHint(null);
    setStatus("connecting");
    subscribeTopicRef.current = topic;

    // mqtt 패키지는 연결 시에만 동적 로드 — 대시보드 초기 번들·파싱 부담 감소
    void import("mqtt")
      .then((mqttModule) => {
        const mqtt = mqttModule.default;
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
            subscribeList,
            { qos: 0 },
            (err) => {
              if (err) {
                setStatus("error");
                setHint(err.message);
              } else {
                callbacksRef.current.onSubscribed?.();
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
            callbacksRef.current.onStored?.();
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
            setHint(`상태 저장 ${json.actuator_key ?? recvTopic}(PRD §6.3)`);
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
      })
      .catch((e) => {
        setStatus("error");
        setHint(e instanceof Error ? e.message : "MQTT 모듈 로드 실패");
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

  const handleSaveSettings = useCallback(() => {
    saveBrowserMqttSettings(form);
    setHint(
      "이 브라우저에 저장했습니다. 변경 적용을 위해 연결 끊기 후 다시 연결하세요.",
    );
    if (status === "live") disconnect();
  }, [form, status, disconnect]);

  const handleClearSettings = useCallback(() => {
    clearBrowserMqttSettings();
    setForm(getEnvDefaultMqttForm());
    setHint("저장값을 지웠습니다. env 기본값을 쓰려면 연결을 다시 시도하세요.");
    if (status === "live") disconnect();
  }, [status, disconnect]);

  const value = useMemo(
    () =>
      ({
        form,
        setForm,
        status,
        hint,
        connect,
        disconnect,
        handleSaveSettings,
        handleClearSettings,
        registerCallbacks,
      }) satisfies MqttBrowserContextValue,
    [
      form,
      status,
      hint,
      connect,
      disconnect,
      handleSaveSettings,
      handleClearSettings,
      registerCallbacks,
    ],
  );

  return (
    <MqttBrowserContext.Provider value={value}>
      {children}
    </MqttBrowserContext.Provider>
  );
}

export function useMqttBrowser(): MqttBrowserContextValue {
  const ctx = useContext(MqttBrowserContext);
  if (!ctx) {
    throw new Error("useMqttBrowser 는 MqttBrowserProvider 안에서만 사용하세요.");
  }
  return ctx;
}
