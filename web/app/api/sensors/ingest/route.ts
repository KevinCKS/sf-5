import { NextResponse } from "next/server";

import { parseSensorPayload } from "@/lib/mqtt/parseSensorPayload";
import { insertSensorReadingsForOwner } from "@/lib/sensors/insertSensorReadingsForOwner";
import { createClient } from "@/lib/supabase/server";

/** 로그인 사용자 본인 소유 센서에만 sensor_readings 저장 (MQTT 페이로드와 동일 규약) */
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

    const raw =
      typeof body === "object" && body !== null
        ? JSON.stringify(body)
        : String(body);
    const parsed = parseSensorPayload(raw);
    if (!parsed) {
      return NextResponse.json(
        {
          error:
            "temp, humi, ec, ph, timestamp 가 포함된 JSON 이어야 합니다.",
        },
        { status: 400 },
      );
    }

    const result = await insertSensorReadingsForOwner(supabase, user.id, parsed);
    if (result.error) {
      return NextResponse.json(
        { error: result.error, inserted: result.inserted },
        { status: 422 },
      );
    }

    return NextResponse.json({ ok: true, inserted: result.inserted });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "서버 오류";
    if (process.env.NODE_ENV === "development") {
      console.error("[api/sensors/ingest]", e);
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
