import type { SupabaseClient } from "@supabase/supabase-js";

/** 센서 타입 → 한글 라벨 (알림 메시지용) */
const TYPE_LABEL: Record<string, string> = {
  temperature: "온도",
  humidity: "습도",
  ec: "EC",
  ph: "pH",
};

type SensorJoin = {
  name: string;
  sensor_type: string;
} | null;

type AlertSettingRow = {
  id: string;
  sensor_id: string;
  min_value: number | null;
  max_value: number | null;
  sensors: SensorJoin | SensorJoin[];
};

function sensorJoinName(row: AlertSettingRow): { name: string; typeLabel: string } {
  const s = Array.isArray(row.sensors) ? row.sensors[0] : row.sensors;
  const name = s?.name ?? "센서";
  const typeLabel = s?.sensor_type
    ? (TYPE_LABEL[s.sensor_type] ?? s.sensor_type)
    : "";
  return { name, typeLabel };
}

export type ReadingForAlert = {
  id: string;
  sensor_id: string;
  value: number;
};

/**
 * 저장된 측정값에 대해 활성 임계치를 검사하고, 초과 시 alert_logs 에 삽입한다.
 * MQTT ingest 직후 동일 세션 클라이언트로 호출한다.
 */
export async function evaluateAlertsForReadings(
  supabase: SupabaseClient,
  ownerId: string,
  readings: ReadingForAlert[],
): Promise<{ logged: number; error?: string }> {
  if (readings.length === 0) {
    return { logged: 0 };
  }

  const sensorIds = [...new Set(readings.map((r) => r.sensor_id))];

  const { data: settings, error: errS } = await supabase
    .from("alert_settings")
    .select("id, sensor_id, min_value, max_value, sensors ( name, sensor_type )")
    .eq("owner_id", ownerId)
    .eq("enabled", true)
    .in("sensor_id", sensorIds);

  if (errS) {
    return { logged: 0, error: errS.message };
  }
  if (!settings?.length) {
    return { logged: 0 };
  }

  const bySensor = new Map(
    (settings as AlertSettingRow[]).map((s) => [s.sensor_id, s]),
  );

  const logs: {
    owner_id: string;
    alert_setting_id: string;
    sensor_reading_id: string;
    message: string;
  }[] = [];

  for (const r of readings) {
    const st = bySensor.get(r.sensor_id);
    if (!st) continue;

    const min = st.min_value;
    const max = st.max_value;
    let breach = false;
    let detail = "";

    if (min != null && r.value < min) {
      breach = true;
      detail = `하한 ${min} 미만`;
    } else if (max != null && r.value > max) {
      breach = true;
      detail = `상한 ${max} 초과`;
    }

    if (!breach) continue;

    const { name, typeLabel } = sensorJoinName(st);
    const msg = `${name}${typeLabel ? ` (${typeLabel})` : ""}: 측정값 ${r.value} — ${detail}`;

    logs.push({
      owner_id: ownerId,
      alert_setting_id: st.id,
      sensor_reading_id: r.id,
      message: msg,
    });
  }

  if (logs.length === 0) {
    return { logged: 0 };
  }

  const { error: errI } = await supabase.from("alert_logs").insert(logs);
  if (errI) {
    return { logged: 0, error: errI.message };
  }
  return { logged: logs.length };
}
