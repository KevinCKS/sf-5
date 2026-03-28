import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/** 알림(임계치 초과) 이력 — 최신순 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limitRaw = searchParams.get("limit") ?? "40";
    const limit = Math.min(100, Math.max(1, parseInt(limitRaw, 10) || 40));

    const { data, error } = await supabase
      .from("alert_logs")
      .select("id, message, created_at, sensor_reading_id, alert_setting_id")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    return NextResponse.json({ logs: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "서버 오류";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
