# Smartfarm 개발 실행 계획 (Plan)

| 항목 | 내용 |
|------|------|
| 기준 문서 | `user/docs/prd.md` |
| 진행 방식 | 아래 **단계 번호 순서대로** 한 단계씩 완료 후 다음 단계로 진행한다. |
| 갱신 | 구현 범위가 바뀌면 본 문서와 PRD를 함께 수정한다. |

---

## 테스트·검증 원칙

- **매 단계마다** 아래 항목을 채운 뒤 다음 단계로 넘어간다. (필요 시 소규모 **회귀**: 이전 단계 핵심 시나리오 1회 재확인.)
- **자동**: ESLint/`npm run build`, 가능하면 단위·통합 테스트.
- **수동**: 브라우저에서 화면·오류 메시지(한글), Supabase Table Editor.
- **MQTT**: MQTTX 등으로 발행·구독 교차 확인(서버 로그와 대조).
- **Arduino**: 시리얼 모니터로 연결·토픽·페이로드 확인; 스케치 소스는 `user/` 하위에 두는 것을 원칙으로 한다(프로젝트 규칙).

---

## 단계 0 — 프로젝트 뼈대

**목표:** PRD §4 기술 스택에 맞는 앱 골격을 만든다.

1. Next.js 15(App Router), TypeScript(strict), ESLint, Tailwind CSS로 프로젝트 생성(또는 동일 구성 확인).
2. Shadcn/ui 초기화 및 공통 UI 패턴 확보.
3. 폴더·네이밍이 프로젝트 규칙(`.cursor/rules`)과 맞는지 정리.

**완료 기준:** `npm run dev`로 기동되고, 기본 페이지가 뜬다.

**테스트·검증:** `npm run lint` / `npm run build` 성공. 홈(또는 샘플 라우트) 접속 확인.

**디렉터리 참고:** 루트에 `user/`, `.cursor/` 등이 있어 `create-next-app .`이 거절되면 Next 앱을 **`web/`** 에 둔다. 이후 `npm run`·환경 변수는 **`web/`** 기준으로 적용한다(`cd web` 후 `npm run dev` 등). PRD의 `user/.env.local`은 키 목록·백업용으로 두고, Next가 로드하는 값은 **`web/.env.local`** 에 두거나 동기화한다.

---

## 단계 1 — 환경 변수 체계

**목표:** PRD §8에 따라 로컬·배포에서 시크릿을 안전하게 쓴다.

1. 로컬: **`web/.env.local`** 에 Next·서버가 읽을 변수를 둔다(실제 값은 커밋하지 않음). (선택) 키 목록 초안은 **`user/.env.local`** 에 두고 `web/.env.local`과 동기화 — PRD §8.
2. Supabase URL·Anon Key, (서버 전용) Service Role 등 PRD에 필요한 변수명 확정.
3. `.gitignore`에 `web/.env.local`·`user/.env.local` 등 `.env*` 누락 없음 확인.

**완료 기준:** 팀이 동일한 키 이름으로 로컬 설정 가능.

**테스트·검증:** 더미 값으로 앱이 기동되는지, 시크릿이 저장소에 올라가지 않았는지(`git status`) 확인.

---

## 단계 2 — Supabase DB 스키마 (핵심 테이블)

**목표:** PRD §5의 `users` 연동, `sensors`, `sensor_readings`, `actuator_controls`, `actuator_status`(§6.3)를 반영한다.

1. `auth.users`와 1:1인 프로필(`users` 또는 동일 역할 테이블) 및 트리거/정책.
2. `sensors`: 메타정보(타입·단위·소속 등 PRD에 맞는 컬럼).
3. `sensor_readings`: 시계열 값, `(sensor_id, recorded_at)` 인덱스.
4. `actuator_controls`: 제어 이력(대상·상태·시각 등).
5. `actuator_status`: 액추 **보고 상태**(§6.3, `owner_id`+`actuator_key`당 최신 1행) — PRD §5.4.1, `coreSchema.sql` 또는 기존 DB에 `user/sql/addActuatorStatusTable.sql` 추가.
6. **RLS**: **사용자(소유자) 기준** 접근 제한 — 단일 농장 전제로 `farms` 없이 `owner_id` 등으로 설계(`user/sql/coreSchema.sql` 참고).

**완료 기준:** Supabase Table Editor에서 테이블·RLS가 동작하고, 읽기/쓰기 시나리오가 검증된다.

**테스트·검증:** SQL Editor 또는 클라이언트로 허용/거부 케이스 각각 실행. 샘플 행 삽입·조회.

---

## 단계 3 — 인증 화면·보호 라우트

**목표:** PRD §2.1, §3.1.

1. 이메일·비밀번호 회원가입·로그인(Supabase Auth).
2. 로그인 후에만 대시보드 등 접근(미들웨어 또는 서버 컴포넌트에서 세션 확인).
3. 로그아웃 및 오류 메시지 **한글** 처리.

**완료 기준:** 비로그인 시 대시보드 진입 불가, 로그인 플로우가 끝까지 동작.

**테스트·검증:** 비로그인 리다이렉트, 잘못된 비밀번호, 회원가입 후 로그인, 로그아웃 후 재접근.

---

## 단계 4 — 대시보드 레이아웃·상태 UI 공통

**목표:** PRD §3.2, §9 비기능(로딩·빈·오류).

1. 메인 대시보드 라우트 구성(Sensor 영역 / Actuator 영역 구획).
2. 로딩 스켈레톤 또는 스피너, 데이터 없음, API 오류 시 안내 문구(한글).

**완료 기준:** 목 데이터 없이도 레이아웃·상태 패턴이 일관되다.

**테스트·검증:** 의도적으로 빈 데이터·지연·오류(목 API)를 넣어 세 가지 상태 UI가 보이는지 확인.

---

## 단계 5 — 센서 데이터: API·필터·차트

**목표:** PRD §2.2.

1. `sensor_readings` 조회 API: 기간·타입 필터(`GET /api/sensor-readings`). 정렬 쿼리 파라미터는 API에 유지 가능하나, **대시보드는 목록 테이블 전에 정렬 UI를 두지 않음**(차트·요약 중심).
2. 대시보드 Sensor: 타입별 요약, 기간·10분 단위 시각, 타입별 라인 차트.
3. 필터: 온도/습도/EC/pH, 기간.

**완료 기준:** DB 샘플로 필터·차트가 동작한다.

**테스트·검증:** 필터·기간·차트 축이 기대와 일치하는지 확인.

---

## 단계 6 — MQTT 인프라·브라우저 수신 (HiveMQ)

**목표:** PRD §2.4, §6, §9 (시크릿 노출 최소화·ACL 권장).

1. HiveMQ Cloud 브로커·자격증명 확보.
2. **브라우저 MQTT**(`NEXT_PUBLIC_MQTT_*`): 대시보드에서 **`smartfarm/sensors`** 와 **`smartfarm/actuators/status/#`** 를 함께 구독 — 센서 수신 시 `POST /api/sensors/ingest`, §6.3 상태 수신 시 `POST /api/actuators/status/ingest`. `web/lib/mqtt/*`에서 allowlist·JSON 파싱.
3. **서버 발행만** 별도 자격: `MQTT_BROKER_URL` 등 — `POST /api/mqtt/publish` 전용(브라우저 번들 금지). 액추 명령은 **QoS 1**, §6.3 상태 토픽은 **발행 allowlist에 없음**(보드만 발행).
4. 토픽 **allowlist**: PRD §6.1 센서, §6.2 명령 액추 4종 — `web/lib/mqtt/allowlist.ts` (`isAllowedMqttPublishTopic`). §6.3은 ingest 검증용 별도 상수.
5. 수신 JSON 키 `temp`, `humi`, `ec`, `ph`, `timestamp` 고정(`parseSensorPayload`). 상세는 `user/check/mqttHiveMQ.md`.

**완료 기준:** MQTTX 등으로 브로커에 발행 → 대시보드에서 MQTT 연결 후 Supabase `sensor_readings` 반영(로그인 사용자·센서 소유 일치 시). §6.3 토픽은 보드·MQTTX 발행으로 `actuator_status`·UI 갱신 확인 가능.

**테스트·검증:** `smartfarm/sensors` 발행 → 브리지 힌트·차트. 선택: `POST /api/mqtt/publish` 로 allowlist 외 토픽 거부 확인.

---

## 단계 7 — Arduino 스케치 (1차): MQTT 프로토콜·토픽 정합

**목표:** PRD §6과 동일한 토픽·JSON으로 **보드가 브로커와 통신**함을 검증한다. (실센서·릴레이는 12단계에서 완성 가능.)

1. Arduino Uno R4 WiFi: WiFi 연결, HiveMQ에 MQTT 연결.
2. **발행:** `smartfarm/sensors`에 PRD 예시 형태 JSON(`temp`,`humi`,`ec`,`ph`,`timestamp`) — 초기에는 고정 더미 값 또는 시리얼 입력 값.
3. **구독:** `smartfarm/actuators/led`, `pump`, `fan1`, `fan2` — 수신 시 시리얼로 `state` 출력.
4. 스케치·시크릿 예시: `user/script/SmartfarmMqttR4WiFi/` — 검증 절차: `user/check/arduinoR4MqttStep7.md`.

**완료 기준:** 시리얼에서 발행 주기·구독 수신이 확인되고, **단계 6**(브라우저 MQTT·MQTTX)과 교차 검증된다.

**테스트·검증:** MQTTX와 보드가 동일 메시지를 주고받는지 확인. 센서는 대시보드 브라우저 MQTT 연결 상태에서 DB 반영 여부로 확인. 액추는 MQTTX로 `{"state":"ON"}` 발행해 보드 구독 반응 확인.

---

## 단계 8 — MQTT 설정 UI·센서 수신 → DB·화면

**목표:** PRD §6.1(웹에서 연결·토픽 설정), §2.2 실시간/최신 반영.

**현재:** 센서 수신 → DB는 **브라우저 MQTT + `POST /api/sensors/ingest`**(로그인 사용자 기준). 대시보드는 `sensor_readings` 조회로 최신값·차트 표시.

1. **설정 UI:** 대시보드 `MqttBrowserBridge` — 브로커 WebSocket URL·사용자명·비밀번호 편집, **이 브라우저에 저장**(localStorage). 기본값은 `NEXT_PUBLIC_MQTT_*` , 비밀번호 비우면 env 폴백. 센서 구독 토픽은 PRD §6.1·`allowlist` 에 따라 `smartfarm/sensors` 고정 표시; 연결 시 **§6.3** `smartfarm/actuators/status/#` 는 코드에서 동시 구독(단계 9와 연동).
2. **저장 후 적용:** 저장 시 연결 중이면 끊고, **연결 끊기 → MQTT 연결**로 재적용.

**완료 기준:** **단계 7** 보드(또는 MQTTX) 발행분이 DB·대시보드에 반영되고, 웹에서 브로커 자격 증명을 바꿔 재연결할 수 있다.

**테스트·검증:** Table Editor·대시보드 수치 일치. 설정 저장 후 재연결·발행 반영 확인.

---

## 단계 9 — 액츄에이터: UI·MQTT 발행·이력·상태 보고(§6.3)

**목표:** PRD §2.3, §6.2, §6.3.

1. 대시보드 **Actuator** 패널(`ActuatorPanel`): LED·Pump·FAN1·FAN2 각각 **ON / OFF**; 행당 **명령**(서버 발행 직후 클라이언트 표시) / **보드**(`actuator_status`) / 갱신 시각 구분.
2. 클릭 시 `POST /api/mqtt/publish` — `{"state":"ON"|"OFF"}` + allowlist 토픽, 서버가 HiveMQ(`MQTT_*` env)로 발행(액추 **QoS 1**).
3. 발행 성공 후 같은 요청에서 `actuator_controls`에 이력 삽입(`owner_id`, `actuator_key`, `state`, `triggered_by`). 이력 목록은 **비동기** 재조회(버튼에 스피너 없음, 동일 행 연타만 `ref`로 방지).
4. **GET** / **DELETE** `/api/actuator-controls` — 본인 최근 이력·비우기.
5. **§6.3** 보드가 `smartfarm/actuators/status/{led|pump|fan1|fan2}` 로 `{"state":"ON"|"OFF"}` 발행 → 브라우저 MQTT가 `smartfarm/actuators/status/#` 구독 → `POST /api/actuators/status/ingest` → **`actuator_status`** upsert.
6. **GET `/api/actuators/status`** — 패널에 보드 상태 병합 표시. 테이블·RLS: `user/sql/coreSchema.sql` 또는 `user/sql/addActuatorStatusTable.sql`.
7. Arduino 예제: `user/script/SmartfarmMqttR4WiFi/` — 명령 콜백 후 §6.3 토픽으로 상태 재발행.

**완료 기준:** 명령 수신(시리얼) + 이력 DB + (Sensor 카드 **MQTT 연결** 시) §6.3 수신 후 `actuator_status`·UI **보드** 표시; 클릭 직후 **명령** 표시로 응답 체감 확보.

**테스트·검증:** 버튼 ON/OFF → 브로커 → Arduino 시리얼·`actuator_controls` → §6.3 발행 → HiveMQ Web Client/MQTTX·대시보드. 커밋 예: `09 Actuator Publish/Status`.

**관련:** `user/check/mqttHiveMQ.md`, PRD §6.2·§6.3, `web/components/dashboard/ActuatorPanel.tsx`.

---

## 단계 10 — 확장: `alert_settings` / `alert_logs`

**목표:** PRD §5.5–5.6.

1. 임계치·알림 설정 테이블 및 UI(최소 기능).
2. 알림 이력 저장·조회(필요 시).

**완료 기준:** PRD에 명시한 확장 범위 중 핵심 플로우가 동작한다.

**테스트·검증:** 임계치 초과 시나리오(목 데이터 또는 시뮬레이션)로 로그 적재 확인.

**구현 메모:** SQL `user/sql/addAlertTables.sql` · 적용 절차 `user/check/applyAlertTables.md` · 평가 로직 `web/lib/alerts/evaluateAlerts.ts` · MQTT 저장 후 `POST /api/sensors/ingest` 에서 `alert_logs` 적재 · Alert 탭 `web/components/dashboard/AlertPanel.tsx` · 검증용 `POST /api/alerts/simulate`.

---

## 단계 11 — 배포 (Vercel + GitHub)

**목표:** PRD §7, §8 배포 측.

1. GitHub 저장소 연동, Vercel 배포 파이프라인(CI/CD).
2. Vercel 환경 변수에 Supabase·MQTT·서버 시크릿 설정(로컬 **`web/.env.local`** 과 동일 키 구조).
3. 프로덕션에서 로그인·MQTT·대시보드 스모크 테스트.

**완료 기준:** 배포 URL에서 핵심 기능이 재현된다.

**테스트·검증:** 프로덕션 URL에서 로그인·센서 조회·(가능 시) MQTT 스모크. Vercel 빌드 로그 오류 없음.

---

## 단계 12 — Arduino 스케치 (2차): 실센서·액츄 하드웨어 연동

**목표:** 현장 하드웨어와 PRD §6이 일치하는 **완성 스케치**로 마무리한다.

1. 실제 센서(또는 프로젝트에 맞는 대체 입력)에서 `temp`,`humi` 등 측정값을 읽어 **단계 7**에서 정한 JSON으로 발행.
2. 액츄에이터(LED/펌프/팬 등)를 각 구독 토픽의 `state`에 맞게 구동(릴레이·PWM 등 회로에 맞게).
3. **단계 8·9** 웹과 **E2E**: 웹에서 보는 값·제어가 보드 동작과 일치.

**완료 기준:** 실기(또는 동등 테스트 벤치)에서 E2E 시나리오 통과. 스케치 버전·배선 메모를 `user/`에 남긴다.

**테스트·검증:** 장시간 연결 끊김 재연결, 이상값(센서 분리 시) 처리 정책이 정해졌다면 그에 맞는 동작 확인.

---

## 진행 시 체크

- 각 단계 시작 전 `prd.md` 해당 절을 다시 확인한다.
- 단계를 건너뛸 경우, 나중에 되돌아올 일이 없도록 의존 관계(예: MQTT 서버는 DB·Auth 이후, Arduino 1차는 MQTT 서버 직후)를 지킨다.
- **Arduino**는 **7(프로토콜 검증)** 과 **12(하드웨어 완성)** 을 분리해, 브로커·웹과 맞지 않을 때 원인이 펌웨어인지 인프라인지 나누기 쉽게 한다.

---

*본 문서는 `prd.md`의 구현 순서와 검증 절차를 돕기 위한 것이다.*
