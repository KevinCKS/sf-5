import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  SENSOR_SORT_OPTIONS,
  type SensorSortId,
} from "@/lib/sensors/constants";
import { sortReadingRows, type SensorReadingRow } from "@/lib/sensors/queryReadings";

/** 센서 시계열 조회 — 기간·타입·정렬 (RLS: 본인 소유 센서만) */
export async function GET(request: Request) {
  try {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const limitParam = searchParams.get("limit");
  const typesParam = searchParams.get("types");
  /** 최근 N건만(시간 구간 무시) — 대시보드 실시간 카드 등 */
  const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : NaN;
  const rowLimit =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 2000)
      : null;
  /** 비어 있으면 본인 소유 전체 타입 — 있으면 해당 sensor_type 센서만 조회해 행·JSON 부담 감소 */
  const typesFilter = typesParam?.split(",").filter(Boolean) ?? [];
  // sort 생략 시 최신순 — 대시보드 차트용. DB 테이블 탭에서는 `sort` 쿼리로 전달 예정
  const sortRaw = searchParams.get("sort") ?? "recorded_at_desc";

  const allowedSorts = new Set(
    SENSOR_SORT_OPTIONS.map((o) => o.id),
  ) as Set<SensorSortId>;
  const sort: SensorSortId = allowedSorts.has(sortRaw as SensorSortId)
    ? (sortRaw as SensorSortId)
    : "recorded_at_desc";

  const defaultTo = new Date();
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 7);

  const fromIso = fromParam
    ? new Date(fromParam).toISOString()
    : defaultFrom.toISOString();
  const toIso = toParam ? new Date(toParam).toISOString() : defaultTo.toISOString();

  const useRowLimit = rowLimit !== null;

  let sensorsQuery = supabase
    .from("sensors")
    .select("id")
    .eq("owner_id", user.id);
  if (typesFilter.length > 0) {
    sensorsQuery = sensorsQuery.in("sensor_type", typesFilter);
  }
  const { data: sensorRows, error: errSensors } = await sensorsQuery;

  if (errSensors) {
    return NextResponse.json({ error: errSensors.message }, { status: 500 });
  }

  const sensorIds = (sensorRows ?? []).map((s) => s.id);
  if (sensorIds.length === 0) {
    return NextResponse.json({ rows: [] as SensorReadingRow[] });
  }

  // limit 모드: 최신 N건(DB desc) — 시간 구간·sort 쿼리는 무시(차트용 시계열은 응답에서 과거→최신 정렬)
  let readingsQuery = supabase
    .from("sensor_readings")
    .select(
      `
      id,
      value,
      recorded_at,
      sensors (
        id,
        name,
        sensor_type,
        unit
      )
    `,
    )
    .in("sensor_id", sensorIds);

  if (useRowLimit) {
    readingsQuery = readingsQuery
      .order("recorded_at", { ascending: false })
      .limit(rowLimit!);
  } else {
    readingsQuery = readingsQuery
      .gte("recorded_at", fromIso)
      .lte("recorded_at", toIso);
    if (sort === "recorded_at_desc") {
      readingsQuery = readingsQuery.order("recorded_at", { ascending: false });
    } else if (sort === "recorded_at_asc") {
      readingsQuery = readingsQuery.order("recorded_at", { ascending: true });
    }
  }

  const { data: readings, error: errRead } = await readingsQuery;

  if (errRead) {
    return NextResponse.json({ error: errRead.message }, { status: 500 });
  }

  // map+filter 대신 한 번 순회 — null 중간 배열·재스캔 생략
  const rows: SensorReadingRow[] = [];
  for (const r of readings ?? []) {
    const raw = r.sensors as unknown;
    const s = Array.isArray(raw) ? raw[0] : raw;
    if (!s || typeof s !== "object") continue;
    const sn = s as {
      name: string;
      sensor_type: string;
      unit: string | null;
    };
    rows.push({
      id: r.id as string,
      value: Number(r.value),
      recorded_at: r.recorded_at as string,
      sensor_type: sn.sensor_type,
      unit: sn.unit,
      sensor_name: sn.name,
    });
  }

  let filtered = rows;
  if (useRowLimit) {
    filtered.sort(
      (a, b) =>
        new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
    );
  } else if (sort !== "recorded_at_desc" && sort !== "recorded_at_asc") {
    filtered = sortReadingRows(filtered, sort);
  }

  return NextResponse.json({ rows: filtered });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "서버 오류";
    if (process.env.NODE_ENV === "development") {
      console.error("[api/sensor-readings]", e);
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
