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

/** 두 배열이 행 단위로 동일하면 true — silent 폴링 시 참조 유지로 불필요한 리렌더·피벗 생략 */
export function sameSensorReadingRows(
  a: SensorReadingRow[],
  b: SensorReadingRow[],
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (
      x.id !== y.id ||
      x.value !== y.value ||
      x.recorded_at !== y.recorded_at ||
      x.sensor_type !== y.sensor_type ||
      x.unit !== y.unit ||
      x.sensor_name !== y.sensor_name
    ) {
      return false;
    }
  }
  return true;
}

/** 정렬 (메모리) — recorded_at 은 행당 Date.parse 1회로 줄임 */
export function sortReadingRows(
  rows: SensorReadingRow[],
  sort: SensorSortId,
): SensorReadingRow[] {
  const copy = [...rows];
  switch (sort) {
    case "recorded_at_desc": {
      const withT = copy.map((r) => ({
        r,
        t: Date.parse(r.recorded_at) || 0,
      }));
      withT.sort((a, b) => b.t - a.t);
      return withT.map((x) => x.r);
    }
    case "recorded_at_asc": {
      const withT = copy.map((r) => ({
        r,
        t: Date.parse(r.recorded_at) || 0,
      }));
      withT.sort((a, b) => a.t - b.t);
      return withT.map((x) => x.r);
    }
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

/**
 * rows 한 번 순회로 타입별 최신값·타입별 단위(첫 등장) — 대시보드 요약+차트 헤더 동시용
 * (이전 latest + unitByType 두 번 돌던 것을 합침)
 */
export function latestAndUnitByTypeFromRows(
  rows: SensorReadingRow[],
): {
  latest: Map<string, { value: number; unit: string | null }>;
  unitByType: Map<string, string | null>;
  /** rows에 나타난 sensor_type — 대시보드에서 선택 타입 필터 교차 시 별도 순회 생략 */
  typesPresent: Set<string>;
} {
  const best = new Map<string, { row: SensorReadingRow; t: number }>();
  const unitByType = new Map<string, string | null>();
  const typesPresent = new Set<string>();

  for (const r of rows) {
    typesPresent.add(r.sensor_type);
    if (!unitByType.has(r.sensor_type)) {
      unitByType.set(r.sensor_type, r.unit);
    }
    const tNew = Date.parse(r.recorded_at) || 0;
    const prev = best.get(r.sensor_type);
    if (!prev || tNew > prev.t) {
      best.set(r.sensor_type, { row: r, t: tNew });
    }
  }

  const latest = new Map<string, { value: number; unit: string | null }>();
  for (const [ty, { row }] of best) {
    latest.set(ty, { value: row.value, unit: row.unit });
  }
  return { latest, unitByType, typesPresent };
}

/** 타입별 최신값 요약 (recorded_at 최대 1건) — 전체 정렬 없이 O(n), 행당 시각 파싱 1회 */
export function latestByType(
  rows: SensorReadingRow[],
): Map<string, { value: number; unit: string | null }> {
  return latestAndUnitByTypeFromRows(rows).latest;
}
