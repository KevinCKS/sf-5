import {
  MQTT_STATUS_TOPICS,
  MQTT_TOPICS,
  isActuatorStatusTopic,
  isAllowedMqttPublishTopic,
  statusTopicToActuatorKey,
} from "@/lib/mqtt/allowlist";
import { topicToActuatorKey } from "@/lib/mqtt/actuatorTopics";

const STORAGE_KEY = "smartfarm.browserMqtt.v1";

/** 액추에이터 토픽 맵 키 (PRD §6.2·§6.3) */
export const ACTUATOR_TOPIC_KEYS = ["led", "pump", "fan1", "fan2"] as const;
export type ActuatorTopicKey = (typeof ACTUATOR_TOPIC_KEYS)[number];

/** 웹에서 저장하는 브라우저 MQTT 연결 설정(로컬 전용, 서버로 전송 안 함) */
export type BrowserMqttSettings = {
  brokerUrl: string;
  username: string;
  password: string;
  sensorTopic: string;
  /** PRD §6.2 — 서버 발행에 쓸 명령 토픽(액추별, allowlist·키 일치 시만 유지) */
  actuatorCommandTopics: Record<ActuatorTopicKey, string>;
  /** PRD §6.3 — 브라우저가 구독할 상태 토픽(액추별, allowlist·키 일치 시만 유지) */
  actuatorStatusSubscribeTopics: Record<ActuatorTopicKey, string>;
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

function defaultActuatorCommandTopics(): Record<ActuatorTopicKey, string> {
  return {
    led: MQTT_TOPICS.actuators.led,
    pump: MQTT_TOPICS.actuators.pump,
    fan1: MQTT_TOPICS.actuators.fan1,
    fan2: MQTT_TOPICS.actuators.fan2,
  };
}

function defaultActuatorStatusSubscribeTopics(): Record<
  ActuatorTopicKey,
  string
> {
  return {
    led: MQTT_STATUS_TOPICS.led,
    pump: MQTT_STATUS_TOPICS.pump,
    fan1: MQTT_STATUS_TOPICS.fan1,
    fan2: MQTT_STATUS_TOPICS.fan2,
  };
}

/** §6.2 명령 토픽 — 해당 액추 키와 일치하는 allowlist 토픽만 허용 */
export function normalizeActuatorCommandTopic(
  key: ActuatorTopicKey,
  raw: string,
): string {
  const t = raw.trim();
  const fallback = MQTT_TOPICS.actuators[key];
  if (!t || !isAllowedMqttPublishTopic(t)) return fallback;
  const mapped = topicToActuatorKey(t);
  return mapped === key ? t : fallback;
}

/** §6.3 상태 토픽 — 해당 액추 키와 일치하는 allowlist 토픽만 허용 */
export function normalizeActuatorStatusSubscribeTopic(
  key: ActuatorTopicKey,
  raw: string,
): string {
  const t = raw.trim();
  const fallback = MQTT_STATUS_TOPICS[key];
  if (!t || !isActuatorStatusTopic(t)) return fallback;
  const mapped = statusTopicToActuatorKey(t);
  return mapped === key ? t : fallback;
}

function normalizeActuatorCommandTopics(
  partial: Partial<Record<ActuatorTopicKey, string>> | undefined,
): Record<ActuatorTopicKey, string> {
  const d = defaultActuatorCommandTopics();
  const out = { ...d };
  for (const k of ACTUATOR_TOPIC_KEYS) {
    out[k] = normalizeActuatorCommandTopic(k, partial?.[k] ?? "");
  }
  return out;
}

/** 저장·연결 직전 — §6.3 맵 전체 정규화 */
export function normalizeActuatorStatusSubscribeTopics(
  partial: Partial<Record<ActuatorTopicKey, string>> | undefined,
): Record<ActuatorTopicKey, string> {
  const d = defaultActuatorStatusSubscribeTopics();
  const out = { ...d };
  for (const k of ACTUATOR_TOPIC_KEYS) {
    out[k] = normalizeActuatorStatusSubscribeTopic(k, partial?.[k] ?? "");
  }
  return out;
}

/** 브라우저 MQTT 구독용 — 센서 토픽 + §6.3 상태 토픽(중복 제거) */
export function buildMqttSubscribeTopicList(
  sensorTopic: string,
  statusByKey: Record<ActuatorTopicKey, string>,
): string[] {
  const st = sensorTopic.trim() || MQTT_TOPICS.sensors;
  const statusList = ACTUATOR_TOPIC_KEYS.map((k) => statusByKey[k].trim()).filter(
    (t) => t !== "",
  );
  return [...new Set([st, ...statusList])];
}

/** MQTT 연결 시 subscribe 할 토픽 배열(폼 값 정규화 후) */
export function getSubscribeTopicListFromForm(
  form: Pick<
    BrowserMqttSettings,
    "sensorTopic" | "actuatorStatusSubscribeTopics"
  >,
): string[] {
  const statusMap = normalizeActuatorStatusSubscribeTopics(
    form.actuatorStatusSubscribeTopics,
  );
  return buildMqttSubscribeTopicList(form.sensorTopic, statusMap);
}

/** localStorage 에서 읽기 */
export function loadBrowserMqttSettings(): Partial<BrowserMqttSettings> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const j = JSON.parse(raw) as Partial<BrowserMqttSettings> & {
      statusSubscribePattern?: string;
    };
    return j && typeof j === "object" ? j : {};
  } catch {
    return {};
  }
}

/** 센서 구독 토픽 — allowlist + ingest 규약상 sensors 만 허용 */
export function normalizeSensorTopic(raw: string): string {
  const t = raw.trim();
  if (t === MQTT_TOPICS.sensors && isAllowedMqttPublishTopic(t)) return t;
  return MQTT_TOPICS.sensors;
}

/** localStorage 에 저장(비밀번호 포함 — 이 브라우저에만 보관됨) */
export function saveBrowserMqttSettings(s: BrowserMqttSettings): void {
  if (typeof window === "undefined") return;
  const normalized: BrowserMqttSettings = {
    ...s,
    sensorTopic: normalizeSensorTopic(s.sensorTopic),
    actuatorCommandTopics: normalizeActuatorCommandTopics(s.actuatorCommandTopics),
    actuatorStatusSubscribeTopics: normalizeActuatorStatusSubscribeTopics(
      s.actuatorStatusSubscribeTopics,
    ),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
}

/** 저장값 초기화 후 env 만 사용 */
export function clearBrowserMqttSettings(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

/** 폼 초기값: 저장분 우선, 없으면 NEXT_PUBLIC_ — 구버전 statusSubscribePattern 은 무시(개별 토픽 기본값) */
export function getInitialMqttForm(): BrowserMqttSettings {
  const stored = loadBrowserMqttSettings();
  return {
    brokerUrl: stored.brokerUrl?.trim() || envBrokerUrl(),
    username: stored.username ?? envUsername(),
    password: stored.password ?? "",
    sensorTopic: normalizeSensorTopic(
      stored.sensorTopic ?? MQTT_TOPICS.sensors,
    ),
    actuatorCommandTopics: normalizeActuatorCommandTopics(
      stored.actuatorCommandTopics,
    ),
    actuatorStatusSubscribeTopics: normalizeActuatorStatusSubscribeTopics(
      stored.actuatorStatusSubscribeTopics,
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
    actuatorCommandTopics: defaultActuatorCommandTopics(),
    actuatorStatusSubscribeTopics: defaultActuatorStatusSubscribeTopics(),
  };
}

/** 연결 시 비밀번호: 폼이 비어 있으면 env 폴백 */
export function resolveConnectPassword(formPassword: string): string {
  const p = formPassword.trim();
  if (p !== "") return p;
  return envPassword();
}
