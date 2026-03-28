import { MQTT_TOPICS } from "@/lib/mqtt/allowlist";

/** allowlist 액추 토픽 → DB actuator_key */
export function topicToActuatorKey(
  topic: string,
): "led" | "pump" | "fan1" | "fan2" | null {
  const m: Record<string, "led" | "pump" | "fan1" | "fan2"> = {
    [MQTT_TOPICS.actuators.led]: "led",
    [MQTT_TOPICS.actuators.pump]: "pump",
    [MQTT_TOPICS.actuators.fan1]: "fan1",
    [MQTT_TOPICS.actuators.fan2]: "fan2",
  };
  return m[topic] ?? null;
}

/** UI 라벨 (PRD §6.2) */
export const ACTUATOR_ROWS: {
  key: "led" | "pump" | "fan1" | "fan2";
  label: string;
  topic: string;
}[] = [
  { key: "led", label: "LED", topic: MQTT_TOPICS.actuators.led },
  { key: "pump", label: "Pump", topic: MQTT_TOPICS.actuators.pump },
  { key: "fan1", label: "FAN1", topic: MQTT_TOPICS.actuators.fan1 },
  { key: "fan2", label: "FAN2", topic: MQTT_TOPICS.actuators.fan2 },
];
