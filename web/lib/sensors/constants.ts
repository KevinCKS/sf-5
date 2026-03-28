/** PRD §2.2·MQTT 정합 — DB sensors.sensor_type 값과 동일 (temp/humi 대응: temperature, humidity) */
export const SENSOR_TYPE_FILTERS = [
  { type: "temperature", label: "온도" },
  { type: "humidity", label: "습도" },
  { type: "ec", label: "EC" },
  { type: "ph", label: "pH" },
] as const;

export type SensorTypeId = (typeof SENSOR_TYPE_FILTERS)[number]["type"];

/** 정렬 옵션 — GET /api/sensor-readings 의 `sort` 와 동일. DB 테이블 화면(예정) 탭에서 사용 예정 */
export const SENSOR_SORT_OPTIONS = [
  { id: "recorded_at_desc", label: "수집일시 · 최신순" },
  { id: "recorded_at_asc", label: "수집일시 · 과거순" },
  { id: "type_asc", label: "센서 타입순 (가나다)" },
  { id: "value_desc", label: "측정값 · 높은순" },
  { id: "value_asc", label: "측정값 · 낮은순" },
] as const;

export type SensorSortId = (typeof SENSOR_SORT_OPTIONS)[number]["id"];
