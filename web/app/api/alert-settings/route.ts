import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/** 본인 소유 임계치 설정 목록 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("alert_settings")
      .select(
        "id, sensor_id, min_value, max_value, enabled, updated_at, sensors ( name, sensor_type, unit )",
      )
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    return NextResponse.json({ settings: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "서버 오류";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

type PutBody = {
  sensor_id?: unknown;
  min_value?: unknown;
  max_value?: unknown;
  enabled?: unknown;
};

/** 센서별 임계치 upsert(sensor_id 당 1행) */
export async function PUT(request: Request) {
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

    const o = body as PutBody;
    const sensor_id = typeof o.sensor_id === "string" ? o.sensor_id : null;
    if (!sensor_id) {
      return NextResponse.json({ error: "sensor_id 가 필요합니다." }, { status: 400 });
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

    const enabled = o.enabled === false ? false : true;

    const parseNum = (v: unknown): number | null => {
      if (v === null || v === undefined || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : NaN;
    };

    const min_value = parseNum(o.min_value);
    const max_value = parseNum(o.max_value);

    if (min_value !== null && Number.isNaN(min_value)) {
      return NextResponse.json({ error: "하한(min_value)이 올바른 숫자가 아닙니다." }, { status: 400 });
    }
    if (max_value !== null && Number.isNaN(max_value)) {
      return NextResponse.json({ error: "상한(max_value)가 올바른 숫자가 아닙니다." }, { status: 400 });
    }

    if (enabled && min_value === null && max_value === null) {
      return NextResponse.json(
        { error: "활성화 시 하한·상한 중 하나 이상을 지정해 주세요." },
        { status: 400 },
      );
    }

    if (
      min_value != null &&
      max_value != null &&
      min_value > max_value
    ) {
      return NextResponse.json(
        { error: "하한은 상한보다 클 수 없습니다." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("alert_settings")
      .upsert(
        {
          owner_id: user.id,
          sensor_id,
          min_value,
          max_value,
          enabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "sensor_id" },
      )
      .select(
        "id, sensor_id, min_value, max_value, enabled, updated_at, sensors ( name, sensor_type, unit )",
      )
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    return NextResponse.json({ ok: true, setting: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "서버 오류";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
