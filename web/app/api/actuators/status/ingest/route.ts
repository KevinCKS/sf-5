import { NextResponse } from "next/server";

import {
  isActuatorStatusTopic,
  statusTopicToActuatorKey,
} from "@/lib/mqtt/allowlist";
import { parseActuatorStatusPayload } from "@/lib/mqtt/parseActuatorStatusPayload";
import { createClient } from "@/lib/supabase/server";

/** 브라우저 MQTT가 §6.3 상태 메시지 수신 시 로그인 사용자 행으로 upsert */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    let body: { topic?: string; payload?: unknown };
    try {
      body = (await request.json()) as { topic?: string; payload?: unknown };
    } catch {
      return NextResponse.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
    }

    const topic = body.topic?.trim() ?? "";
    if (!topic || !isActuatorStatusTopic(topic)) {
      return NextResponse.json(
        { error: "허용되지 않은 상태 토픽입니다. PRD §6.3 을 따릅니다." },
        { status: 400 },
      );
    }

    const actKey = statusTopicToActuatorKey(topic);
    if (!actKey) {
      return NextResponse.json({ error: "토픽 매핑 오류" }, { status: 400 });
    }

    const raw =
      typeof body.payload === "object" && body.payload !== null
        ? JSON.stringify(body.payload)
        : null;
    const parsed = raw ? parseActuatorStatusPayload(raw) : null;
    if (!parsed) {
      return NextResponse.json(
        { error: "payload는 {\"state\":\"ON\"|\"OFF\"} 형식이어야 합니다." },
        { status: 400 },
      );
    }

    const { error } = await supabase.from("actuator_status").upsert(
      {
        owner_id: user.id,
        actuator_key: actKey,
        state: parsed.state,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "owner_id,actuator_key" },
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, actuator_key: actKey, state: parsed.state });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "서버 오류";
    if (process.env.NODE_ENV === "development") {
      console.error("[api/actuators/status/ingest]", e);
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
