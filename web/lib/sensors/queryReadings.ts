import type { SensorSortId } from "@/lib/sensors/constants";

/** API·서버 공통 — 조회 결과 한 행 */
export type SensorReadingRow = {
  id: string;
  value: number;
  recorded_at: string;
  sensor_type: string;
  unit: string | null;
  sensor_name: string;
};

/** 정렬 (메모리) */
export function sortReadingRows(
  rows: SensorReadingRow[],
  sort: SensorSortId,
): SensorReadingRow[] {
  const copy = [...rows];
  switch (sort) {
    case "recorded_at_desc":
      return copy.sort(
        (a, b) =>
          new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
      );
    case "recorded_at_asc":
      return copy.sort(
        (a, b) =>
          new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
      );
    case "type_asc":
      return copy.sort((a, b) =>
        a.sensor_type.localeCompare(b.sensor_type, "ko"),
      );
    case "value_desc":
      return copy.sort((a, b) => b.value - a.value);
    case "value_asc":
      return copy.sort((a, b) => a.value - b.value);
    default:
      return copy;
  }
}

/** 타입별 최신값 요약 (수집일시 최신 1건) */
export function latestByType(
  rows: SensorReadingRow[],
): Map<string, { value: number; unit: string | null }> {
  const sorted = sortReadingRows(rows, "recorded_at_desc");
  const map = new Map<string, { value: number; unit: string | null }>();
  for (const r of sorted) {
    if (!map.has(r.sensor_type)) {
      map.set(r.sensor_type, { value: r.value, unit: r.unit });
    }
  }
  return map;
}
