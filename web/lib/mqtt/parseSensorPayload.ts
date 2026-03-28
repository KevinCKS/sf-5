/** PRD §6.1 — Arduino 발행 JSON 규약 (키 고정) */

export type SensorMqttPayload = {
  temp: number;
  humi: number;
  ec: number;
  ph: number;
  timestamp: string;
};

function toFiniteNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** MQTT 문자열 → 검증된 페이로드, 실패 시 null */
export function parseSensorPayload(raw: string): SensorMqttPayload | null {
  let j: unknown;
  try {
    j = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (j === null || typeof j !== "object") return null;
  const o = j as Record<string, unknown>;
  const temp = toFiniteNumber(o.temp);
  const humi = toFiniteNumber(o.humi);
  const ec = toFiniteNumber(o.ec);
  const ph = toFiniteNumber(o.ph);
  const ts = o.timestamp;
  if (
    temp === null ||
    humi === null ||
    ec === null ||
    ph === null ||
    typeof ts !== "string" ||
    ts.trim() === ""
  ) {
    return null;
  }
  return { temp, humi, ec, ph, timestamp: ts.trim() };
}
