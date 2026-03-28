import { NextResponse } from "next/server";
import mqtt from "mqtt";

import { topicToActuatorKey } from "@/lib/mqtt/actuatorTopics";
import { MQTT_TOPICS, isAllowedMqttPublishTopic } from "@/lib/mqtt/allowlist";
import { parseSensorPayload } from "@/lib/mqtt/parseSensorPayload";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** 브로커 URL 에서 호스트만 추출(응답·로그용, 비밀 없음) */
function brokerHostFromUrl(brokerUrl: string): string {
  try {
    return new URL(brokerUrl).hostname;
  } catch {
    return "(URL 형식 오류)";
  }
}

/** 서버 env MQTT 자격증명 — allowlist 토픽만 발행, 액추는 actuator_controls 이력 저장 */
export async function POST(request: Request) {
  try {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const url = process.env.MQTT_BROKER_URL;
  const mqttUser = process.env.MQTT_USERNAME;
  const mqttPass = process.env.MQTT_PASSWORD;

  if (!url || !mqttUser || mqttPass === undefined) {
    return NextResponse.json(
      { error: "서버에 MQTT 환경 변수가 설정되어 있지 않습니다." },
      { status: 503 },
    );
  }

  let body: { topic?: string; payload?: unknown };
  try {
    body = (await request.json()) as { topic?: string; payload?: unknown };
  } catch {
    return NextResponse.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const topic = body.topic?.trim() ?? "";
  if (!topic || !isAllowedMqttPublishTopic(topic)) {
    return NextResponse.json(
      { error: "허용되지 않은 토픽입니다. PRD §6 allowlist 만 사용할 수 있습니다." },
      { status: 400 },
    );
  }

  let payloadStr: string;

  if (topic === MQTT_TOPICS.sensors) {
    const raw =
      typeof body.payload === "object" && body.payload !== null
        ? JSON.stringify(body.payload)
        : null;
    const parsed = raw ? parseSensorPayload(raw) : null;
    if (!parsed) {
      return NextResponse.json(
        {
          error:
            "센서 토픽은 temp, humi, ec, ph, timestamp 가 포함된 JSON 이어야 합니다.",
        },
        { status: 400 },
      );
    }
    payloadStr = JSON.stringify(parsed);
  } else {
    const p = body.payload as { state?: unknown } | undefined;
    if (p?.state !== "ON" && p?.state !== "OFF") {
      return NextResponse.json(
        { error: "액츄에이터 토픽은 payload.state 가 ON 또는 OFF 여야 합니다." },
        { status: 400 },
      );
    }
    payloadStr = JSON.stringify({ state: p.state });
  }

  const brokerHost = brokerHostFromUrl(url);

  // 액추는 QoS 1 — 브로커 PUBACK까지 받음(센서 스트림은 QoS 0)
  const publishQos: 0 | 1 = topic === MQTT_TOPICS.sensors ? 0 : 1;

  try {
    await publishOnce(url, mqttUser, mqttPass, topic, payloadStr, publishQos);
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[mqtt/publish] OK topic=${topic} host=${brokerHost} payload=${payloadStr}`,
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "MQTT 발행 실패";
    if (process.env.NODE_ENV === "development") {
      console.error(`[mqtt/publish] FAIL host=${brokerHost}`, e);
    }
    return NextResponse.json({ error: msg, brokerHost }, { status: 502 });
  }

  const actKey = topicToActuatorKey(topic);
  if (actKey) {
    const st = (JSON.parse(payloadStr) as { state: string }).state;
    const { error: dbErr } = await supabase.from("actuator_controls").insert({
      owner_id: user.id,
      actuator_key: actKey,
      state: st,
      triggered_by: user.id,
    });
    if (dbErr) {
      return NextResponse.json(
        {
          error: `MQTT 발행은 됐으나 이력 저장에 실패했습니다: ${dbErr.message}`,
          topic,
          brokerHost,
          mqttOk: true,
        },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({ ok: true, topic, brokerHost });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "서버 오류";
    if (process.env.NODE_ENV === "development") {
      console.error("[api/mqtt/publish]", e);
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function publishOnce(
  brokerUrl: string,
  username: string,
  password: string,
  topic: string,
  payload: string,
  qos: 0 | 1,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(brokerUrl, {
      username,
      password,
      connectTimeout: 12_000,
    });
    const timer = setTimeout(() => {
      client.end(true);
      reject(new Error("MQTT 연결·발행 시간 초과"));
    }, 14_000);

    client.on("error", (err) => {
      clearTimeout(timer);
      client.end(true);
      reject(err);
    });

    client.on("connect", () => {
      client.publish(topic, payload, { qos }, (err) => {
        clearTimeout(timer);
        client.end(true, {}, () => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  });
}
