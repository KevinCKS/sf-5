# 단계 0 ~ 6 회귀 검증 절차

`user/docs/plan.md` 기준. **모두 `web/`** 에서 npm 실행(경로: 저장소 루트의 `web/`).

---

## 공통 (자동)

```bash
cd web
npm run lint
npm run build
```

- 성공 시 단계 0·1·빌드 가능 상태 확인.

---

## 단계 0 — 프로젝트 뼈대

| 절차 | 기대 |
|------|------|
| `cd web && npm run dev` | Turbopack 기동, 오류 없음 |
| 브라우저 `http://localhost:3000` | 앱 기본 화면 접속 |

---

## 단계 1 — 환경 변수

`web/.env.example` 과 동일한 키 구조로 `web/.env.local` 을 채운다.

| 구분 | 변수 | 용도 |
|------|------|------|
| Supabase (필수) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 앱·로그인·세션 API |
| MQTT — 브라우저 | `NEXT_PUBLIC_MQTT_BROKER_URL`, `NEXT_PUBLIC_MQTT_USERNAME`, `NEXT_PUBLIC_MQTT_PASSWORD` | Sensor 대시보드 **브라우저 MQTT**(HiveMQ WebSocket `wss://…`). **클라이언트에 노출** |
| MQTT — 서버 발행 | `MQTT_BROKER_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD` | **`POST /api/mqtt/publish` 만**(브라우저 번들 금지) |

| 절차 | 기대 |
|------|------|
| `web/.env.local` 존재·위 키가 검증 시나리오에 맞게 설정 | (값은 비공개) |
| `git status` | `.env.local` 이 추적되지 않음(`.gitignore`) |

---

## 단계 2 — DB 스키마

| 절차 | 기대 |
|------|------|
| Supabase SQL Editor에서 `user/sql/coreSchema.sql` 적용 이력 | `profiles`, `sensors`, `sensor_readings`, `actuator_controls` 존재 |
| (선택) 레거시 `mqtt_devices` 제거 | `user/sql/dropMqttDevices.sql` 실행 후 테이블 없음 |
| Table Editor | RLS 켜진 상태(정책은 coreSchema 참고) |

---

## 단계 3 — 인증

| 절차 | 기대 |
|------|------|
| 시크릿 창에서 `/dashboard` 직접 접속 | 로그인 페이지로 리다이렉트 또는 비보호 시 접근 불가 |
| `/signup` 로 회원가입 또는 기존 계정 `/login` | 성공 시 대시보드로 이동 |
| 잘못된 비밀번호 | 한글 등 사용자용 오류 메시지 |
| 로그아웃 후 `/dashboard` | 다시 로그인 요구 |

---

## 단계 4 — 대시보드 레이아웃·상태 UI

| 절차 | 기대 |
|------|------|
| 로그인 후 `/dashboard` | Sensor / Actuator 영역 레이아웃 |
| Sensor에 데이터 없음·기간 밖 | 빈 상태 안내(한글) |
| 로딩 시 스피너 등 | 짧게 표시 후 결과 또는 빈 상태 |
| Sensor 상단 **브라우저 MQTT** 영역 | `NEXT_PUBLIC_MQTT_BROKER_URL` 미설정 시 안내 문구만; 설정 시 **MQTT 연결 / 연결 끊기** 가능 |

---

## 단계 5 — 센서 API·필터·차트

| 절차 | 기대 |
|------|------|
| `user/sql/seedSensorSample.sql` — 이메일을 본인 계정으로 수정 후 실행 | `sensors` + `sensor_readings` 샘플 |
| 대시보드 Sensor: 기간·타입·다시 조회 | 표·요약·타입별 라인 차트 |
| 기간을 샘플 데이터가 포함되게 조정 | 차트에 선이 보임(데이터 있는 경우) |

---

## 단계 6 — MQTT (HiveMQ) → 브라우저 → 로그인 세션 DB

페이로드: `temp`, `humi`, `ec`, `ph`, `timestamp` — `web/lib/mqtt/parseSensorPayload.ts` 규약. 토픽: `smartfarm/sensors`.

**준비:** `NEXT_PUBLIC_MQTT_BROKER_URL`(예: `wss://…`), `NEXT_PUBLIC_MQTT_USERNAME`, `NEXT_PUBLIC_MQTT_PASSWORD`. **로그인한 사용자**에게 `seedSensorSample.sql` 등으로 `sensors.owner_id` 가 맞는 센서가 있어야 `sensor_readings` 에 저장된다.

| 절차 | 기대 |
|------|------|
| `npm run dev` 로 앱 기동, **로그인** 후 `/dashboard` | Sensor 영역에 브라우저 MQTT 카드 표시 |
| **MQTT 연결** 클릭 | 상태가 **구독 중** 으로 바뀜(자격증명·URL 오류 시 오류 표시) |
| MQTTX 등으로 동일 브로커·토픽 `smartfarm/sensors` 발행 | 대시보드 힌트에 저장 건수 또는 API 오류 메시지 |
| (브라우저 DevTools Network) | `POST /api/sensors/ingest` — 로그인 세션(`credentials: include`) |
| Supabase `sensor_readings` | 본인 소유 센서에 대해 새 행 증가 |
| **연결 끊기** | 구독 종료, 탭을 닫으면 수집 중단 |

### 선택

| 절차 | 기대 |
|------|------|
| 로그인 상태에서 `POST /api/mqtt/publish` — allowlist 토픽 | 200. 임의 토픽 `forbidden/topic` | 400 |

---

## 한 번에 끝내는 최소 스모크 (요약)

1. `cd web` → `npm run lint` && `npm run build`  
2. `npm run dev` → 로그인 → `/dashboard` Sensor 차트(시드 후)  
3. `NEXT_PUBLIC_MQTT_*` 설정 → 대시보드 **MQTT 연결** → MQTTX로 `smartfarm/sensors` 발행 → 힌트·차트 반영  

---

문제 시: `user/check/mqttHiveMQ.md`, `web/.env.example` 참고.
