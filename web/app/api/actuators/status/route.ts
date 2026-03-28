import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/** 본인 actuator_status 최신 행(보드 §6.3 반영값) */
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
      .from("actuator_status")
      .select("actuator_key, state, updated_at")
      .eq("owner_id", user.id)
      .order("actuator_key", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rows: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "서버 오류";
    if (process.env.NODE_ENV === "development") {
      console.error("[api/actuators/status]", e);
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
