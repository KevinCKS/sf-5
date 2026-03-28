/** PRD §6.1·§6.2 — 서버 발행/검증용 토픽 allowlist (MQTT 비밀번호는 서버 env 만) */

export const MQTT_TOPICS = {
  sensors: "smartfarm/sensors",
  actuators: {
    led: "smartfarm/actuators/led",
    pump: "smartfarm/actuators/pump",
    fan1: "smartfarm/actuators/fan1",
    fan2: "smartfarm/actuators/fan2",
  },
} as const;

const ALLOWED = new Set<string>([
  MQTT_TOPICS.sensors,
  MQTT_TOPICS.actuators.led,
  MQTT_TOPICS.actuators.pump,
  MQTT_TOPICS.actuators.fan1,
  MQTT_TOPICS.actuators.fan2,
]);

/** 발행·구독 허용 토픽인지 (정확히 일치) */
export function isAllowedMqttTopic(topic: string): boolean {
  return ALLOWED.has(topic);
}
