import { NextResponse } from "next/server";

import { evaluateAlertsForReadings } from "@/lib/alerts/evaluateAlerts";
import { createClient } from "@/lib/supabase/server";

/**
 * 임계치 검증·로그 적재를 MQTT 없이 확인할 때 사용.
 * 본인 소유 센서에 측정값 1건을 넣은 뒤 alert_settings 와 비교한다.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
    }

    const o = body as { sensor_id?: unknown; value?: unknown };
    const sensor_id = typeof o.sensor_id === "string" ? o.sensor_id : null;
    const valueRaw = o.value;
    if (!sensor_id) {
      return NextResponse.json({ error: "sensor_id 가 필요합니다." }, { status: 400 });
    }
    const value = Number(valueRaw);
    if (!Number.isFinite(value)) {
      return NextResponse.json({ error: "value 는 숫자여야 합니다." }, { status: 400 });
    }

    const { data: sensor, error: errSe } = await supabase
      .from("sensors")
      .select("id")
      .eq("id", sensor_id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (errSe || !sensor) {
      return NextResponse.json(
        { error: "센서를 찾을 수 없거나 권한이 없습니다." },
        { status: 403 },
      );
    }

    const { data: row, error: errI } = await supabase
      .from("sensor_readings")
      .insert({
        sensor_id,
        value,
        recorded_at: new Date().toISOString(),
      })
      .select("id, sensor_id, value")
      .single();

    if (errI || !row) {
      return NextResponse.json(
        { error: errI?.message ?? "측정값 저장에 실패했습니다." },
        { status: 422 },
      );
    }

    const ev = await evaluateAlertsForReadings(supabase, user.id, [
      {
        id: row.id as string,
        sensor_id: row.sensor_id as string,
        value: Number(row.value),
      },
    ]);

    if (ev.error && process.env.NODE_ENV === "development") {
      console.warn("[api/alerts/simulate]", ev.error);
    }

    return NextResponse.json({
      ok: true,
      sensorReadingId: row.id,
      alertsLogged: ev.logged,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "서버 오류";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
