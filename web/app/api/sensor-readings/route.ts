import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  SENSOR_SORT_OPTIONS,
  type SensorSortId,
} from "@/lib/sensors/constants";
import { sortReadingRows, type SensorReadingRow } from "@/lib/sensors/queryReadings";

/** 센서 시계열 조회 — 기간·타입·정렬 (RLS: 본인 소유 센서만) */
export async function GET(request: Request) {
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
  const typesParam = searchParams.get("types");
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

  const { data: sensorRows, error: errSensors } = await supabase
    .from("sensors")
    .select("id")
    .eq("owner_id", user.id);

  if (errSensors) {
    return NextResponse.json({ error: errSensors.message }, { status: 500 });
  }

  const sensorIds = (sensorRows ?? []).map((s) => s.id);
  if (sensorIds.length === 0) {
    return NextResponse.json({ rows: [] as SensorReadingRow[] });
  }

  const { data: readings, error: errRead } = await supabase
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
        unit,
        owner_id
      )
    `,
    )
    .in("sensor_id", sensorIds)
    .gte("recorded_at", fromIso)
    .lte("recorded_at", toIso);

  if (errRead) {
    return NextResponse.json({ error: errRead.message }, { status: 500 });
  }

  const rows: SensorReadingRow[] = (readings ?? [])
    .map((r) => {
      const raw = r.sensors as unknown;
      const s = Array.isArray(raw) ? raw[0] : raw;
      if (!s || typeof s !== "object") return null;
      const sn = s as {
        name: string;
        sensor_type: string;
        unit: string | null;
      };
      return {
        id: r.id as string,
        value: Number(r.value),
        recorded_at: r.recorded_at as string,
        sensor_type: sn.sensor_type,
        unit: sn.unit,
        sensor_name: sn.name,
      };
    })
    .filter((x): x is SensorReadingRow => x !== null);

  const typesFilter = typesParam?.split(",").filter(Boolean) ?? [];
  let filtered =
    typesFilter.length > 0
      ? rows.filter((row) => typesFilter.includes(row.sensor_type))
      : rows;

  filtered = sortReadingRows(filtered, sort);

  return NextResponse.json({ rows: filtered });
}
