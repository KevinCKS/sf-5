import type { SupabaseClient } from "@supabase/supabase-js";
import type { SensorMqttPayload } from "@/lib/mqtt/parseSensorPayload";

/** MQTT 페이로드 키 → DB sensors.sensor_type */
const MQTT_TO_DB: Record<"temp" | "humi" | "ec" | "ph", string> = {
  temp: "temperature",
  humi: "humidity",
  ec: "ec",
  ph: "ph",
};

/**
 * 로그인 세션 클라이언트 또는 서비스 롤 클라이언트로 동일 — owner_id 기준 센서에 sensor_readings 삽입
 */
export async function insertSensorReadingsForOwner(
  supabase: SupabaseClient,
  ownerId: string,
  data: SensorMqttPayload,
): Promise<{ inserted: number; error?: string }> {
  if (ownerId.trim() === "") {
    return {
      inserted: 0,
      error: "owner_id 가 비어 있어 UUID 조회를 할 수 없습니다.",
    };
  }

  const { data: sensors, error: errS } = await supabase
    .from("sensors")
    .select("id, sensor_type")
    .eq("owner_id", ownerId);

  if (errS) {
    return { inserted: 0, error: errS.message };
  }

  const byType = new Map(
    (sensors ?? []).map((s) => [s.sensor_type, s.id as string]),
  );

  const recordedAt = (() => {
    const d = new Date(data.timestamp);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  })();

  const rows: { sensor_id: string; value: number; recorded_at: string }[] = [];
  for (const key of ["temp", "humi", "ec", "ph"] as const) {
    const st = MQTT_TO_DB[key];
    const sid = byType.get(st);
    if (!sid) continue;
    rows.push({
      sensor_id: sid,
      value: data[key],
      recorded_at: recordedAt,
    });
  }

  if (rows.length === 0) {
    return {
      inserted: 0,
      error:
        "해당 계정에 temperature/humidity/ec/ph 센서 메타가 없어 저장하지 않았습니다.",
    };
  }

  const { error: errI } = await supabase.from("sensor_readings").insert(rows);
  if (errI) {
    return { inserted: 0, error: errI.message };
  }
  return { inserted: rows.length };
}
