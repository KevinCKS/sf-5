#!/usr/bin/env node
/**
 * 아두이노 없이 브로커에 센서값을 주기 발행하고, 액추에이터 명령 토픽을 구독합니다.
 * 토픽·JSON은 web/lib/mqtt/allowlist.ts · parseSensorPayload 규약과 동일합니다.
 *
 * 준비: 이 폴더에서 `npm install`
 * 실행: `node mqttTest.js` — 기본적으로 저장소 `web/.env.local`을 읽어 MQTT URL·자격증명을 채웁니다.
 *       (이미 셸에 설정된 변수는 덮어쓰지 않음)
 *
 * 브로커 URL·계정(우선순위: 셸 환경변수 → 아래 키 순):
 *   MQTT_URL 또는 MQTT_BROKER_URL 또는 NEXT_PUBLIC_MQTT_BROKER_URL
 *   MQTT_USERNAME 또는 NEXT_PUBLIC_MQTT_USERNAME
 *   MQTT_PASSWORD 또는 NEXT_PUBLIC_MQTT_PASSWORD
 *
 * 기타 옵션:
 *   MQTT_CLIENT_ID     기본값 smartfarm-sim-node
 *   SENSOR_INTERVAL_MS 기본 10000 (10초)
 *   ECHO_STATUS        1이면 명령 수신 시 §6.3 상태 토픽으로 재발행(보드 시뮬). 기본 1
 *   DOTENV_PATH        .env.local 대신 사용할 파일 경로(절대·상대)
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mqtt from "mqtt";

const __dirname = dirname(fileURLToPath(import.meta.url));
/** Next 앱과 동일한 `web/.env.local` (MQTT_BROKER_URL, NEXT_PUBLIC_MQTT_* 등) */
const DEFAULT_WEB_ENV_LOCAL = join(__dirname, "..", "..", "..", "web", ".env.local");

function loadDotenv() {
  const custom = process.env.DOTENV_PATH?.trim();
  const path = custom || DEFAULT_WEB_ENV_LOCAL;
  const r = dotenv.config({ path });
  if (r.error) {
    const code = r.error.code;
    if (code === "ENOENT") {
      console.warn(
        `[env] 파일 없음(무시): ${path} — 셸 환경변수만 사용하거나 DOTENV_PATH 로 지정하세요.`,
      );
    } else {
      console.warn(`[env] 로드 경고: ${r.error.message}`);
    }
  } else {
    console.log(`[env] 로드: ${path}`);
  }
}

/** .env.local 과 Next/서버 API와 동일한 키 이름 지원 */
function resolveBrokerUrl() {
  return (
    process.env.MQTT_URL?.trim() ||
    process.env.MQTT_BROKER_URL?.trim() ||
    process.env.NEXT_PUBLIC_MQTT_BROKER_URL?.trim() ||
    ""
  );
}

function resolveUsername() {
  return (
    process.env.MQTT_USERNAME?.trim() ||
    process.env.NEXT_PUBLIC_MQTT_USERNAME?.trim() ||
    ""
  );
}

function resolvePassword() {
  return (
    process.env.MQTT_PASSWORD?.trim() ||
    process.env.NEXT_PUBLIC_MQTT_PASSWORD?.trim() ||
    ""
  );
}

loadDotenv();

const SENSOR_TOPIC = "smartfarm/sensors";
const ACTUATOR_TOPICS = [
  "smartfarm/actuators/led",
  "smartfarm/actuators/pump",
  "smartfarm/actuators/fan1",
  "smartfarm/actuators/fan2",
];
/** 명령 토픽 → §6.3 상태 토픽 (Arduino 스케치와 동일 매핑) */
const STATUS_TOPIC_BY_CMD = {
  "smartfarm/actuators/led": "smartfarm/actuators/status/led",
  "smartfarm/actuators/pump": "smartfarm/actuators/status/pump",
  "smartfarm/actuators/fan1": "smartfarm/actuators/status/fan1",
  "smartfarm/actuators/fan2": "smartfarm/actuators/status/fan2",
};

function round2(n) {
  return Math.round(n * 100) / 100;
}

/** PRD §6.1 — temp, humi, ec, ph, timestamp */
function randomSensorPayload() {
  return {
    temp: round2(18 + Math.random() * 14),
    humi: round2(40 + Math.random() * 45),
    ec: round2(0.5 + Math.random() * 2.5),
    ph: round2(5.5 + Math.random() * 2),
    timestamp: new Date().toISOString(),
  };
}

function parseStatePayload(buf) {
  try {
    const j = JSON.parse(buf.toString());
    if (j && typeof j === "object" && (j.state === "ON" || j.state === "OFF")) {
      return j.state;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function main() {
  const url = resolveBrokerUrl();
  if (!url) {
    console.error(
      "[오류] 브로커 URL이 없습니다. web/.env.local 에 MQTT_BROKER_URL 또는 NEXT_PUBLIC_MQTT_BROKER_URL 을 넣거나, MQTT_URL 을 셸에 설정하세요.",
    );
    process.exit(1);
  }

  const user = resolveUsername();
  const pass = resolvePassword();
  const clientId =
    process.env.MQTT_CLIENT_ID?.trim() || "smartfarm-sim-node";
  const intervalMs = Math.max(
    1000,
    Number.parseInt(process.env.SENSOR_INTERVAL_MS ?? "10000", 10) || 10000,
  );
  const echoStatus = process.env.ECHO_STATUS !== "0";

  const client = mqtt.connect(url, {
    username: user || undefined,
    password: pass || undefined,
    clientId,
    reconnectPeriod: 3000,
    ...(url.startsWith("wss:") || url.startsWith("ws:")
      ? { protocolVersion: 4 }
      : {}),
  });

  let publishTimer = null;

  client.on("connect", () => {
    console.log("[MQTT] 연결됨:", url.replace(/:[^:@/]+@/, ":****@"));
    client.subscribe(ACTUATOR_TOPICS, (err) => {
      if (err) {
        console.error("[MQTT] 액추 구독 실패:", err.message);
        return;
      }
      console.log("[MQTT] 액추 명령 구독:", ACTUATOR_TOPICS.join(", "));
    });

    const publishOnce = () => {
      const payload = randomSensorPayload();
      const body = JSON.stringify(payload);
      client.publish(SENSOR_TOPIC, body, { qos: 1 }, (err) => {
        if (err) console.error("[센서] 발행 실패:", err.message);
        else
          console.log(
            "[센서]",
            SENSOR_TOPIC,
            body.slice(0, 120) + (body.length > 120 ? "…" : ""),
          );
      });
    };

    publishOnce();
    publishTimer = setInterval(publishOnce, intervalMs);
    console.log(`[센서] ${intervalMs}ms 마다 랜덤 값 발행`);
  });

  client.on("message", (topic, payload) => {
    const state = parseStatePayload(payload);
    const text = payload.toString();
    console.log("[액추 수신]", topic, text);
    if (!state) {
      console.log("       → state(ON/OFF) 파싱 실패 — 페이로드 형식 확인");
      return;
    }
    const statusTopic = STATUS_TOPIC_BY_CMD[topic];
    if (echoStatus && statusTopic && client.connected) {
      const statusBody = JSON.stringify({ state });
      client.publish(statusTopic, statusBody, { qos: 1 }, (err) => {
        if (err) console.error("[§6.3 상태] 발행 실패:", err.message);
        else console.log("       → [§6.3 에코]", statusTopic, statusBody);
      });
    }
  });

  client.on("error", (err) => {
    console.error("[MQTT] 오류:", err.message);
  });

  client.on("reconnect", () => {
    console.log("[MQTT] 재연결 시도…");
  });

  const shutdown = () => {
    if (publishTimer) clearInterval(publishTimer);
    client.end(true, {}, () => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
