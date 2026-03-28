# HiveMQ · MQTT (현재 구현 기준)

## 동작 요약

| 항목 | 내용 |
|------|------|
| 신뢰 경계 | 브로커 자격증명으로 붙은 클라이언트만 발행한다고 가정. 구독 토픽은 PRD §6.1 `smartfarm/sensors`. |
| DB 소유자 | **로그인한 사용자** — `POST /api/sensors/ingest` 가 `sensors.owner_id = auth.uid()` 인 행에만 `sensor_readings` 삽입 (`insertSensorReadingsForOwner`). |
| 페이로드 | `temp`, `humi`, `ec`, `ph`, `timestamp` — `web/lib/mqtt/parseSensorPayload.ts` |
| 센서 수신 | Sensor 대시보드 **브라우저 MQTT**(`MqttBrowserBridge`) — 탭이 열려 있는 동안만 구독, 수신 시 세션으로 `POST /api/sensors/ingest` |
| `timestamp` | 브리지 경로에서는 **브라우저가 수신 직전** `new Date().toISOString()` 으로 설정(보드·MQTTX가 넣은 값은 덮어씀). 의미는 “브라우저가 MQTT를 받은 시각”에 가깝다. |
| 발행 API | `POST /api/mqtt/publish` — 로그인 세션, allowlist 토픽만. 서버는 `MQTT_BROKER_URL` 등 **서버 전용** 변수로 브로커에 연결 (`web/lib/mqtt/allowlist.ts`) |

## 환경 변수 (`web/.env.local`)

- `NEXT_PUBLIC_MQTT_BROKER_URL`, `NEXT_PUBLIC_MQTT_USERNAME`, `NEXT_PUBLIC_MQTT_PASSWORD` — **브라우저 MQTT**(HiveMQ WebSocket `wss://…`). 클라이언트에 노출되므로 프로덕션에서는 브로커 ACL·제한 계정 권장.
- `MQTT_BROKER_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD` — **`POST /api/mqtt/publish` 전용**, 브라우저 번들에 넣지 않음.

## 브라우저에서 검증

1. `NEXT_PUBLIC_MQTT_*` 설정 후 `npm run dev`, 로그인 → `/dashboard` → **MQTT 연결**
2. MQTTX로 토픽 `smartfarm/sensors`, 페이로드는 위 키 준수

## MQTTX (동일 브로커)

- 토픽: `smartfarm/sensors`
- JSON: PRD §6.1 예시와 동일(위 페이로드 키).

## 예전 `mqtt_devices` 테이블이 있는 경우

`user/sql/dropMqttDevices.sql` 실행 후 테이블 제거(선택).

## 관련 코드 경로

- `web/lib/mqtt/allowlist.ts`, `parseSensorPayload.ts`
- `web/app/api/mqtt/publish/route.ts`
- `web/app/api/sensors/ingest/route.ts`, `web/lib/sensors/insertSensorReadingsForOwner.ts`
- `web/components/dashboard/MqttBrowserBridge.tsx`
