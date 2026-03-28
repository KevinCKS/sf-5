import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/** 로그인 사용자 본인 소유 센서의 sensor_readings 행 전부 삭제(RLS) */
export async function DELETE() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { data: sensors, error: errS } = await supabase
      .from("sensors")
      .select("id")
      .eq("owner_id", user.id);

    if (errS) {
      return NextResponse.json({ error: errS.message }, { status: 500 });
    }

    const ids = (sensors ?? []).map((s) => s.id as string);
    if (ids.length === 0) {
      return NextResponse.json({ ok: true, deleted: 0 });
    }

    const { count, error: errC } = await supabase
      .from("sensor_readings")
      .select("*", { count: "exact", head: true })
      .in("sensor_id", ids);

    if (errC) {
      return NextResponse.json({ error: errC.message }, { status: 500 });
    }

    const { error: errD } = await supabase
      .from("sensor_readings")
      .delete()
      .in("sensor_id", ids);

    if (errD) {
      return NextResponse.json({ error: errD.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, deleted: count ?? 0 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "서버 오류";
    if (process.env.NODE_ENV === "development") {
      console.error("[api/sensor-readings/clear]", e);
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
