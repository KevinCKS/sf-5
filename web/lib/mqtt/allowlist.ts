/** PRD §6.1·§6.2·§6.3 — 서버 발행·ingest 검증용 토픽 (MQTT 비밀번호는 서버 env 만) */

export const MQTT_TOPICS = {
  sensors: "smartfarm/sensors",
  actuators: {
    led: "smartfarm/actuators/led",
    pump: "smartfarm/actuators/pump",
    fan1: "smartfarm/actuators/fan1",
    fan2: "smartfarm/actuators/fan2",
  },
} as const;

/** PRD §6.3 — 보드가 발행·웹이 구독해 DB에 반영하는 “실제 상태” 토픽 */
export const MQTT_STATUS_TOPICS = {
  led: "smartfarm/actuators/status/led",
  pump: "smartfarm/actuators/status/pump",
  fan1: "smartfarm/actuators/status/fan1",
  fan2: "smartfarm/actuators/status/fan2",
} as const;

/** 브라우저 구독: 상태 계열 한 번에 (MQTT 와일드카드 #) */
export const MQTT_STATUS_SUBSCRIBE_PATTERN = "smartfarm/actuators/status/#" as const;

const PUBLISH_ALLOWED = new Set<string>([
  MQTT_TOPICS.sensors,
  MQTT_TOPICS.actuators.led,
  MQTT_TOPICS.actuators.pump,
  MQTT_TOPICS.actuators.fan1,
  MQTT_TOPICS.actuators.fan2,
]);

const STATUS_TOPIC_TO_KEY = new Map<string, "led" | "pump" | "fan1" | "fan2">([
  [MQTT_STATUS_TOPICS.led, "led"],
  [MQTT_STATUS_TOPICS.pump, "pump"],
  [MQTT_STATUS_TOPICS.fan1, "fan1"],
  [MQTT_STATUS_TOPICS.fan2, "fan2"],
]);

/** 서버 POST /api/mqtt/publish 허용 토픽(명령·센서만 — §6.3 상태 토픽은 제외) */
export function isAllowedMqttPublishTopic(topic: string): boolean {
  return PUBLISH_ALLOWED.has(topic);
}

/** 발행 allowlist — 하위 호환 이름(isAllowedMqttTopic) */
export function isAllowedMqttTopic(topic: string): boolean {
  return isAllowedMqttPublishTopic(topic);
}

/** §6.3 상태 토픽(정확히 일치) */
export function isActuatorStatusTopic(topic: string): boolean {
  return STATUS_TOPIC_TO_KEY.has(topic);
}

/** 상태 토픽 → DB actuator_key */
export function statusTopicToActuatorKey(
  topic: string,
): "led" | "pump" | "fan1" | "fan2" | null {
  return STATUS_TOPIC_TO_KEY.get(topic) ?? null;
}
