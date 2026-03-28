# Smartfarm 웹 서비스 — PRD (제품 요구사항 정의서)

| 항목 | 내용 |
|------|------|
| 문서 목적 | 개발·디자인·운영이 동일한 범위를 이해하고 바로 구현할 수 있도록 요구사항을 고정한다. |
| 대상 독자 | 프론트엔드·백엔드·임베디드(Arduino) 담당자 |
| 전제 | 단일 제품(스마트팜 모니터링·제어) 기준으로 작성한다. |
| 저장소 레이아웃 | Next 앱을 저장소 루트가 아닌 **`web/`** 등 하위에 둘 수 있다. 이 경우 로컬 환경 변수·실행 경로는 §8을 따른다. |

---

## 1. 제품 개요

스마트팜 환경에서 **센서 데이터 수집·조회·시각화**와 **액츄에이터 원격 제어**를 제공하는 웹 애플리케이션이다.  
현장 장비는 **Arduino Uno R4 WiFi**를 사용하며, **HiveMQ Cloud** MQTT 브로커를 통해 웹 서비스와 통신한다.

---

## 2. 주요 기능

### 2.1 인증 (Supabase Auth)

- **이메일·비밀번호** 기반 회원가입 및 로그인.
- 세션 유지·로그아웃 등 Supabase Auth 표준 흐름을 따른다.
- 로그인 후에만 대시보드 등 보호 라우트 접근.

### 2.2 센서 데이터 — 필터·정렬·표시

| 구분 | 요구사항 |
|------|----------|
| **필터** | 센서 타입: 온도, 습도, EC, pH. 기간: 일자 및 시간 범위 선택. |
| **정렬** | 수집일시(최신순/과거순), 센서 타입순, 측정값 기준(높은순/낮은순). |
| **표시** | 요약 레이블(숫자·단위) 및 **라인 차트**로 시계열 표현. |

### 2.3 액츄에이터 제어

- 대상: **식물성장 LED**, **Pump**, **FAN1**, **FAN2**.
- UI: 각각 **ON/OFF** 버튼(또는 동등한 토글).
- 명령 MQTT 발행·DB 이력(`actuator_controls`)은 §6.2, 보드가 보고하는 **실제 상태** 저장(`actuator_status`)은 §6.3을 따른다.

### 2.4 MQTT 연동 (Arduino ↔ 웹)

- **브로커**: HiveMQ Cloud.
- **센서**: Arduino **발행(Publish)** → 웹 측 **구독(Subscribe)** 후 화면·DB 반영.
- **액츄에이터(명령)**: Arduino **구독(Subscribe)** → 웹에서 **발행(Publish)** 으로 명령 전달(§6.2).
- **액츄에이터(상태)**: Arduino **발행(Publish)** → 웹 **구독(Subscribe)** 후 `actuator_status` 반영(§6.3).
- 토픽·페이로드 규격은 **§6**을 따른다.

---

## 3. 화면 구성

### 3.1 로그인 / 회원가입

- 이메일·비밀번호 입력, 회원가입, 계정 관련 흐름.
- 오류 시 사용자에게 이해 가능한 메시지(한글).

### 3.2 대시보드(메인)

| 영역 | 내용 |
|------|------|
| **Sensor** | 실시간 또는 최신 센서 요약, §2.2 필터·정렬·차트. |
| **Actuator** | §2.3 ON/OFF 제어, `actuator_controls` 최근 이력·비우기, §6.3 **보드 상태** 및 **명령 직후** 피드백(동일 카드 행). |

---

## 4. 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | **Next.js 15** (App Router) |
| 언어 | **TypeScript** (strict 권장) |
| 스타일 | **Tailwind CSS** |
| UI 컴포넌트 | **Shadcn/ui** |
| BaaS | **Supabase** (Auth, DB) |
| 정적 분석 | **ESLint** (Next.js / TypeScript 규칙 기반) |
| MQTT 브로커 | **HiveMQ Cloud** |
| 임베디드 | **Arduino Uno R4 WiFi** |

---

## 5. 데이터 구조 (Supabase)

논리 모델 기준이다. 컬럼명·타입·RLS·인덱스는 마이그레이션/SQL로 확정한다.

### 5.1 `users`

- 사용자 **프로필** 관리. Supabase Auth(`auth.users`)와 **1:1** 연동.

### 5.2 `sensors`

- 센서(장비) **메타정보**(이름, 타입, 단위, 구역 등). **단일 농장** 전제로 사용자 소유(`owner`)로 관리한다(별도 `farms` 테이블 없음).

### 5.3 `sensor_readings`

- 센서별 **시계열 측정값** (`sensor_id`, `value`, `recorded_at` 등).

### 5.4 `actuator_controls`

- 액츄에이터 **ON/OFF 제어 이력**(웹·서버가 명령 발행 시 기록).

### 5.4.1 `actuator_status`

- 액츄에이터 **실제(보고된) 상태** — 보드가 §6.3 토픽으로 `{"state":"ON"|"OFF"}` 를 발행하면 웹이 수신·저장한다. 사용자(`owner_id`)와 `actuator_key` 조합당 **최신 1행**(upsert).

### 5.5 `alert_settings` (확장)

- 임계치 및 알림 설정.
- 컬럼(구현 기준): `owner_id`, `sensor_id`(센서당 1행), `min_value`·`max_value`(nullable, 둘 중 하나 이상), `enabled`, 시각 메타.
- MQTT→`sensor_readings` 저장 직후 서버가 임계치를 검사해 초과 시 `alert_logs`에 기록한다.

### 5.6 `alert_logs` (확장)

- 알림 발생 이력.
- 컬럼(구현 기준): `owner_id`, `alert_setting_id`, `sensor_reading_id`, `message`, `created_at`.

---

## 6. MQTT Topic / Payload

### 6.1 센서값 — Arduino **발행**, 웹 **구독**

- 온도·습도·EC·pH를 **하나의 JSON**에 묶어 **한 번에 발행**한다.
- **웹 화면**에서 MQTT 연결·토픽 등을 **실시간 설정**할 수 있어야 한다(서버 allowlist·권한 검증 권장).

**Topic 예**

```text
smartfarm/sensors
```

**Payload 예**

```json
{
  "temp": 24.5,
  "humi": 62.0,
  "ec": 1.2,
  "ph": 6.1,
  "timestamp": "2026-03-28T12:34:56.000Z"
}
```

- Arduino·서버·DB 매핑 시 키 이름(`temp`, `humi` 등)을 동일 규약으로 유지한다.

**브라우저 구독·DB 저장(구현 메모)**  
웹 클라이언트가 동일 브로커(WebSocket)에 연결해 **`smartfarm/sensors`** 와 **`smartfarm/actuators/status/#`** (§6.3) 를 **함께** 구독한다. 센서 수신 JSON은 검증 후 `POST /api/sensors/ingest` → 본인 소유 `sensors`에만 `sensor_readings` 저장. §6.3 상태 메시지는 `POST /api/actuators/status/ingest` → `actuator_status` upsert. 탭을 닫으면 구독이 끊긴다. `NEXT_PUBLIC_` 자격 증명은 프로덕션에서 ACL·전용 계정 권장.

### 6.2 액츄에이터 — Arduino **구독**, 웹 **발행**

- 식물성장 LED, Pump, FAN1, FAN2에 대해 **토픽을 각각 분리**하여 Arduino가 구독한다.
- **웹**에서 브로커 연결·자격은 Sensor 영역 MQTT 설정(`NEXT_PUBLIC_MQTT_*`·localStorage)과 동일하게 쓰되, **명령 토픽 문자열은 allowlist 고정**(편집 UI 없음).

**Topic 예**

| 대상 | Topic |
|------|--------|
| 식물성장 LED | `smartfarm/actuators/led` |
| Pump | `smartfarm/actuators/pump` |
| FAN1 | `smartfarm/actuators/fan1` |
| FAN2 | `smartfarm/actuators/fan2` |

**Payload 예**

```json
{"state":"ON"}
```

(`OFF` 등 임베디드와 동일한 규약으로 고정)

**서버 발행(구현 메모)**  
`POST /api/mqtt/publish` 는 로그인 세션·**allowlist** 만 허용한다. **§6.3 상태 토픽은 웹·서버에서 발행하지 않는다**(보드 전용). 액추 **명령** 토픽은 HiveMQ 전달 확인을 위해 **QoS 1**, `smartfarm/sensors` 발행 경로는 **QoS 0**. 서버는 `MQTT_BROKER_URL` 등 **서버 전용 env**로만 브로커에 연결한다. 발행 성공 후에만 `actuator_controls` 에 이력 삽입한다.

### 6.3 액추 실제 상태 — Arduino **발행**, 웹 **구독**

- 보드는 명령(§6.2) 수신 처리 후(또는 동일 시점에) **상태를 별도 토픽으로 발행**한다.
- 웹은 동일 브로커에서 해당 토픽(또는 `smartfarm/actuators/status/#`)을 구독하고, 로그인 세션으로 `POST /api/actuators/status/ingest` 를 호출해 **`actuator_status`** 를 갱신한다.

**Topic 예**

| 대상 | Topic |
|------|--------|
| 식물성장 LED | `smartfarm/actuators/status/led` |
| Pump | `smartfarm/actuators/status/pump` |
| FAN1 | `smartfarm/actuators/status/fan1` |
| FAN2 | `smartfarm/actuators/status/fan2` |

**Payload 예**

```json
{"state":"ON"}
```

**구독 와일드카드** — `smartfarm/actuators/status/#`

**대시보드 UI(구현 메모)**  
액추 행에는 (1) **`POST /api/mqtt/publish` 성공 직후** 클라이언트에만 존재하는 **명령 반영** 표시(서버 발행 완료, 보드 §6.3 보고 전), (2) **`actuator_status`** 기반 **보드 보고** 표시를 구분한다. 보고가 오기 전에는 명령 표시가 유지되며, DB의 `updated_at` 이 명령 시각 이후로 갱신되면 보드 값이 우선한다.

---

## 7. 배포

- **호스팅**: Vercel.
- **CI/CD**: GitHub 저장소와 연동하여 빌드·배포 파이프라인을 적용한다.

---

## 8. 환경 변수 관리

| 환경 | 관리 위치 |
|------|-----------|
| **로컬 개발(Next)** | **`web/.env.local`** — `npm run dev` 등은 `web/`에서 실행하며, Next.js가 이 경로의 환경 변수를 로드한다. |
| **로컬(초안·백업)** | (선택) **`user/.env.local`** — 사용자 문서·키 목록 초안용. 프로젝트 규칙상 사용자 전용 파일은 `user/`에 둘 수 있다. **실제 앱 실행 값은 `web/.env.local`과 동기화**한다. |
| **배포** | **Vercel** 프로젝트 환경 변수. 모노레포인 경우 Vercel에서 Root Directory를 `web` 등으로 지정하면 해당 앱 기준으로 설정한다. |

- 로컬과 배포의 **키 이름·구성**을 맞춘다. 시크릿(MQTT 비밀번호, Supabase 서비스 롤 키 등)은 **저장소에 커밋하지 않는다.**
- 저장소 루트에 Next 앱만 두는 구조로 바꾼 경우에는 **프로젝트 루트의 `.env.local`** 이 로드 기준이 될 수 있으며, 그때는 본 절의 `web/`을 루트에 맞게 해석하면 된다.

---

## 9. 비기능 요구사항 (요약)

- **보안**: MQTT·DB 시크릿은 클라이언트 번들에 노출하지 않는다.
- **사용성**: 로딩·빈 데이터·오류 상태 UI를 제공한다.
- **오류 메시지**: 사용자에게 보이는 문구는 **한글**로 간결하게.

---

## 10. 개발 시 체크리스트 (요약)

- [ ] Supabase Auth 로그인·회원가입·보호 라우트
- [ ] 대시보드: 센서 필터·정렬·라인차트·액츄에이터(명령·보드 상태·이력)
- [ ] DB: `profiles`, `sensors`, `sensor_readings`, `actuator_controls`, `actuator_status` (확장: `alert_*` 등은 단계적)
- [ ] HiveMQ 연동 및 §6 토픽·JSON 규약에 맞춘 Arduino·웹 연동
- [ ] Vercel + GitHub CI/CD
- [ ] §8에 따른 환경 변수(로컬 `web/.env.local`, 선택 `user/.env.local` 초안, Vercel)

**구현 반영 메모 (액추·MQTT·UI)**  
서버 `POST /api/mqtt/publish`, `GET`/`DELETE` `/api/actuator-controls`, `GET` `/api/actuators/status`, `POST` `/api/actuators/status/ingest`; 브라우저 `MqttBrowserBridge` 가 센서·§6.3 상태 동시 구독; `ActuatorPanel` 에서 명령 성공 직후 표시와 `actuator_status` 보고 구분, 제어 버튼은 스피너 없이 동작(동일 행 연타만 방지). Arduino 예제 스케치는 §6.3 상태 발행 포함(`user/script/SmartfarmMqttR4WiFi/`). 상세는 `user/docs/plan.md` 단계 6·8·9, `user/check/mqttHiveMQ.md`.

---

*본 문서는 요구사항의 기준선이며, 구현 중 변경 시 본 PRD를 갱신한다.*
