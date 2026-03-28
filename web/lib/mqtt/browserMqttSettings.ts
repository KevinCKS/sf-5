import { MQTT_TOPICS, isAllowedMqttTopic } from "@/lib/mqtt/allowlist";

const STORAGE_KEY = "smartfarm.browserMqtt.v1";

/** 웹에서 저장하는 브라우저 MQTT 연결 설정(로컬 전용, 서버로 전송 안 함) */
export type BrowserMqttSettings = {
  brokerUrl: string;
  username: string;
  password: string;
  sensorTopic: string;
};

function envBrokerUrl(): string {
  return process.env.NEXT_PUBLIC_MQTT_BROKER_URL ?? "";
}

function envUsername(): string {
  return process.env.NEXT_PUBLIC_MQTT_USERNAME ?? "";
}

function envPassword(): string {
  return process.env.NEXT_PUBLIC_MQTT_PASSWORD ?? "";
}

/** localStorage 에서 읽기 */
export function loadBrowserMqttSettings(): Partial<BrowserMqttSettings> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const j = JSON.parse(raw) as Partial<BrowserMqttSettings>;
    return j && typeof j === "object" ? j : {};
  } catch {
    return {};
  }
}

/** localStorage 에 저장(비밀번호 포함 — 이 브라우저에만 보관됨) */
export function saveBrowserMqttSettings(s: BrowserMqttSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

/** 저장값 초기화 후 env 만 사용 */
export function clearBrowserMqttSettings(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

/** 센서 구독 토픽 — allowlist + ingest 규약상 sensors 만 허용 */
export function normalizeSensorTopic(raw: string): string {
  const t = raw.trim();
  if (t === MQTT_TOPICS.sensors && isAllowedMqttTopic(t)) return t;
  return MQTT_TOPICS.sensors;
}

/** 폼 초기값: 저장분 우선, 없으면 NEXT_PUBLIC_ */
export function getInitialMqttForm(): BrowserMqttSettings {
  const stored = loadBrowserMqttSettings();
  return {
    brokerUrl: stored.brokerUrl?.trim() || envBrokerUrl(),
    username: stored.username ?? envUsername(),
    password: stored.password ?? "",
    sensorTopic: normalizeSensorTopic(
      stored.sensorTopic ?? MQTT_TOPICS.sensors,
    ),
  };
}

/** localStorage 삭제 후 쓸 env 기본 폼 */
export function getEnvDefaultMqttForm(): BrowserMqttSettings {
  return {
    brokerUrl: envBrokerUrl(),
    username: envUsername(),
    password: "",
    sensorTopic: MQTT_TOPICS.sensors,
  };
}

/** 연결 시 비밀번호: 폼이 비어 있으면 env 폴백 */
export function resolveConnectPassword(formPassword: string): string {
  const p = formPassword.trim();
  if (p !== "") return p;
  return envPassword();
}
