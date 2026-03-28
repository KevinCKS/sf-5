import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/** 본인 actuator_controls 최근 이력 */
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
    const rawLimit = parseInt(searchParams.get("limit") ?? "20", 10);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(50, Math.max(1, rawLimit))
      : 20;

    const { data, error } = await supabase
      .from("actuator_controls")
      .select("id, actuator_key, state, recorded_at")
      .eq("owner_id", user.id)
      .order("recorded_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      rows: data ?? [],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "서버 오류";
    if (process.env.NODE_ENV === "development") {
      console.error("[api/actuator-controls]", e);
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** 본인 actuator_controls 행 전부 삭제(RLS: owner_id = auth.uid()) */
export async function DELETE() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { error } = await supabase
      .from("actuator_controls")
      .delete()
      .eq("owner_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "서버 오류";
    if (process.env.NODE_ENV === "development") {
      console.error("[api/actuator-controls DELETE]", e);
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
