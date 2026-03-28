# HiveMQ · MQTT (현재 구현 기준)

## 동작 요약

| 항목 | 내용 |
|------|------|
| 신뢰 경계 | 브로커 자격증명으로 붙은 클라이언트만 발행한다고 가정. 브리지 구독: §6.1 `smartfarm/sensors` + §6.3 `smartfarm/actuators/status/#`. |
| DB 소유자 | **로그인한 사용자** — `POST /api/sensors/ingest` 가 `sensors.owner_id = auth.uid()` 인 행에만 `sensor_readings` 삽입 (`insertSensorReadingsForOwner`). |
| 페이로드 | `temp`, `humi`, `ec`, `ph`, `timestamp` — `web/lib/mqtt/parseSensorPayload.ts` |
| 센서 수신 | Sensor 대시보드 **브라우저 MQTT**(`MqttBrowserBridge`) — 탭이 열려 있는 동안만 구독, 수신 시 세션으로 `POST /api/sensors/ingest` |
| 액추 상태 수신 | 동일 브리지가 §6.3 상태 메시지 수신 시 `POST /api/actuators/status/ingest` → `actuator_status` upsert |
| `timestamp` | 브리지 경로에서는 **브라우저가 수신 직전** `new Date().toISOString()` 으로 설정(보드·MQTTX가 넣은 값은 덮어씀). 의미는 “브라우저가 MQTT를 받은 시각”에 가깝다. |
| 발행 API | `POST /api/mqtt/publish` — 로그인 세션, **명령·센서** allowlist 만(§6.3 상태 토픽 발행 불가). 서버는 `MQTT_BROKER_URL` 등 **서버 전용** env. 액추 **명령**은 **QoS 1**, 센서 토픽은 QoS 0. 성공 후 `actuator_controls` 이력 (`actuatorTopics.ts`) |
| 액추 이력 API | `GET` / `DELETE` `/api/actuator-controls` — 본인 `actuator_controls` |
| 액추 상태 API | `GET /api/actuators/status`, `POST /api/actuators/status/ingest` — 본인 `actuator_status` |

## 환경 변수 (`web/.env.local`)

- `NEXT_PUBLIC_MQTT_BROKER_URL`, `NEXT_PUBLIC_MQTT_USERNAME`, `NEXT_PUBLIC_MQTT_PASSWORD` — **브라우저 MQTT** 기본값(HiveMQ WebSocket `wss://…`). 대시보드에서 **연결·토픽 설정**으로 덮어쓸 수 있으며, 그 값은 **localStorage**에만 저장(서버 미전송). 클라이언트 노출·로컬 저장 모두 프로덕션에서는 ACL·전용 계정 권장.
- `MQTT_BROKER_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD` — **`POST /api/mqtt/publish` 전용**, 브라우저 번들에 넣지 않음.

## 브라우저에서 검증

1. `NEXT_PUBLIC_MQTT_*` 설정 후 `npm run dev`, 로그인 → `/dashboard` → **MQTT 연결**
2. MQTTX로 토픽 `smartfarm/sensors`, 페이로드는 위 키 준수

## MQTTX (동일 브로커)

- 토픽: `smartfarm/sensors`
- JSON: PRD §6.1 예시와 동일(위 페이로드 키).

## 예전 `mqtt_devices` 테이블이 있는 경우

`user/sql/dropMqttDevices.sql` 실행 후 테이블 제거(선택).

## 문제 해결: `actuator_controls`에는 쌓이는데 HiveMQ·아두이노에 메시지가 안 보일 때

- **코드 순서**: `POST /api/mqtt/publish`는 **MQTT 발행이 성공한 뒤**에만 `actuator_controls`에 INSERT한다. 따라서 이 API로 들어온 행이면 서버는 이미 브로커에 publish 콜백까지 통과했다고 본다.
- **가장 흔한 원인**: `web/.env.local`의 **`MQTT_BROKER_URL` 호스트**가 아두이노(`arduino_secrets.h`)·MQTTX·HiveMQ 웹 콘솔에서 보는 **클러스터와 다름**(오타, 예전 URL, 다른 HiveMQ 인스턴스). 발행은 “다른 브로커”로 가고, 사용자가 구독·모니터링하는 쪽에는 안 보인다.
- **확인**: 개발 서버 터미널에 `[mqtt/publish] OK topic=… host=…` 로그가 찍히는지 본다. 브라우저 개발자 도구 Network에서 `POST /api/mqtt/publish` 응답 JSON의 **`brokerHost`**가 아두이노가 붙는 호스트와 같은지 비교한다.
- **Node 서버 권장 URL**: HiveMQ Cloud는 보통 **`mqtts://<클러스터>.hivemq.cloud:8883`**(TLS). 브라우저용 `wss://…:8884/mqtt`와 **호스트는 같아야** 하고, 포트·프로토콜은 역할별로 다를 수 있다.

## 대시보드 UX (액추)

- 제어 버튼: 스피너 없음; 서버 응답 전 **명령** 배지(클라이언트)로 즉시 피드백, 이후 §6.3 **보드** 값으로 전환(`ActuatorPanel`).

## 관련 코드 경로

- `web/lib/mqtt/allowlist.ts`, `parseSensorPayload.ts`, `parseActuatorStatusPayload.ts`, `browserMqttSettings.ts`
- `web/app/api/mqtt/publish/route.ts`, `web/app/api/actuator-controls/route.ts`, `web/app/api/actuators/status/route.ts`, `web/app/api/actuators/status/ingest/route.ts`
- `web/components/dashboard/ActuatorPanel.tsx`
- `web/app/api/sensors/ingest/route.ts`, `web/lib/sensors/insertSensorReadingsForOwner.ts`
- `web/components/dashboard/MqttBrowserBridge.tsx`
