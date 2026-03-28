import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/** 본인 소유 센서 메타 목록 — Alert 설정 등에서 선택용 */
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
      .from("sensors")
      .select("id, name, sensor_type, unit, zone_name")
      .eq("owner_id", user.id)
      .order("sensor_type", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    return NextResponse.json({ sensors: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "서버 오류";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
