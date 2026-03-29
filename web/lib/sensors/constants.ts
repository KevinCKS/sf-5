/** PRD §2.2·MQTT 정합 — DB sensors.sensor_type 값과 동일 (temp/humi 대응: temperature, humidity) */
export const SENSOR_TYPE_FILTERS = [
  { type: "temperature", label: "온도" },
  { type: "humidity", label: "습도" },
  { type: "ec", label: "EC" },
  { type: "ph", label: "pH" },
] as const;

/** 타입 id → 한글 라벨 — 렌더 루프에서 반복 .find 대신 O(1) 조회 */
export const SENSOR_TYPE_LABEL_BY_ID: ReadonlyMap<string, string> = new Map(
  SENSOR_TYPE_FILTERS.map((x) => [x.type, x.label]),
);

/** DB·MQTT 등에서 온 sensor_type 문자열을 한글 라벨로 변환(미등록은 원문 유지) */
export function sensorTypeLabel(typeId: string): string {
  return SENSOR_TYPE_LABEL_BY_ID.get(typeId) ?? typeId;
}

export type SensorTypeId = (typeof SENSOR_TYPE_FILTERS)[number]["type"];

/** 대시보드 요약 카드 진행 바·표시용 물리 범위(PR·가이드) */
export const SENSOR_VALUE_BOUNDS: Record<
  SensorTypeId,
  { min: number; max: number }
> = {
  temperature: { min: 0, max: 50 },
  humidity: { min: 0, max: 100 },
  ec: { min: 0, max: 6 },
  ph: { min: 0, max: 14 },
};

/** 진행 바 위·아래 작은 라벨(참조 UI) */
export const SENSOR_RANGE_LABELS: Record<
  SensorTypeId,
  { min: string; max: string }
> = {
  temperature: { min: "0°C", max: "50°C" },
  humidity: { min: "0%", max: "100%" },
  ec: { min: "0 mS/cm", max: "6 mS/cm" },
  ph: { min: "0", max: "14" },
};

/** 차트 선·요약 진행 막대 공통 — 틸보다 노랑·라임 쪽으로 더 당긴 톤(타입별 명도만 구분) */
export const SENSOR_SERIES_STROKE: Record<SensorTypeId, string> = {
  temperature: "oklch(0.73 0.118 138)",
  humidity: "oklch(0.67 0.108 152)",
  ec: "oklch(0.61 0.102 160)",
  ph: "oklch(0.57 0.095 132)",
};

/** 요약 카드 하단 막대 — 위 stroke 와 동일 톤 그라데이션 */
export const SENSOR_PROGRESS_BAR_CLASS: Record<SensorTypeId, string> = {
  temperature:
    "bg-gradient-to-r from-[oklch(0.64_0.115_132)] via-[oklch(0.56_0.105_136)] to-[oklch(0.5_0.098_140)]",
  humidity:
    "bg-gradient-to-r from-[oklch(0.58_0.105_146)] via-[oklch(0.52_0.098_150)] to-[oklch(0.46_0.092_154)]",
  ec:
    "bg-gradient-to-r from-[oklch(0.53_0.1_154)] via-[oklch(0.47_0.095_158)] to-[oklch(0.42_0.088_162)]",
  ph:
    "bg-gradient-to-r from-[oklch(0.5_0.092_126)] via-[oklch(0.44_0.086_130)] to-[oklch(0.39_0.08_134)]",
};

/** 미등록 타입 시 차트 선 fallback */
export function sensorSeriesStroke(typeId: string): string {
  return SENSOR_SERIES_STROKE[typeId as SensorTypeId] ?? "var(--chart-1)";
}

/** 정렬 옵션 — GET /api/sensor-readings 의 `sort` 와 동일. DB 테이블 화면(예정) 탭에서 사용 예정 */
export const SENSOR_SORT_OPTIONS = [
  { id: "recorded_at_desc", label: "수집일시 · 최신순" },
  { id: "recorded_at_asc", label: "수집일시 · 과거순" },
  { id: "type_asc", label: "센서 타입순 (가나다)" },
  { id: "value_desc", label: "측정값 · 높은순" },
  { id: "value_asc", label: "측정값 · 낮은순" },
] as const;

export type SensorSortId = (typeof SENSOR_SORT_OPTIONS)[number]["id"];

/** 대시보드 Sensor 카드·「실시간 조회」— GET /api/sensor-readings?limit= (최신순 N행) */
export const SENSOR_DASHBOARD_LIVE_LIMIT = 50;
