# MQTT 보드 시뮬레이터 (`mqttTest.js`)

아두이노 없이 **동일 브로커**에 센서 JSON을 주기 발행하고, 액추에이터 **명령** 토픽을 구독하는 Node 스크립트입니다. PRD §6.1·§6.2·§6.3 토픽·페이로드는 `web/lib/mqtt/allowlist.ts` 및 Arduino 스케치와 맞춥니다.

전체 MQTT·HiveMQ·대시보드 검증 흐름은 [`mqttHiveMQ.md`](./mqttHiveMQ.md)를 참고하세요.

## 위치·준비

| 항목 | 내용 |
|------|------|
| 폴더 | `user/script/mqttBoardSimulator/` |
| 의존성 | 해당 폴더에서 `npm install` (한 번) |
| 실행 파일 | `mqttTest.js` |

## 실행 (Windows PowerShell 예)

```powershell
cd <저장소>\user\script\mqttBoardSimulator
node mqttTest.js
```

시작 시 `[env] 로드: ...\web\.env.local` 이 보이면, Next 앱과 같은 파일에서 브로커 URL·계정을 읽은 것입니다.

## 동작 요약

| 항목 | 내용 |
|------|------|
| 센서 발행 | 토픽 `smartfarm/sensors`, JSON 키 `temp`, `humi`, `ec`, `ph`, `timestamp`(ISO 문자열). 기본 **10초마다** 랜덤 값 |
| 액추 구독 | `smartfarm/actuators/led`, `pump`, `fan1`, `fan2` — 수신 시 콘솔에 출력 |
| §6.3 에코(기본 ON) | 명령 수신 시 Arduino와 같이 `smartfarm/actuators/status/{led|pump|fan1|fan2}` 로 `{"state":"ON"\|"OFF"}` 재발행. 끄려면 환경변수 `ECHO_STATUS=0` |

## 대시보드·DB와의 관계

- **센서값이 DB에 쌓이려면** 대시보드에서 **브라우저 MQTT 연결**이 되어 있어야 합니다(탭이 열린 상태에서 `smartfarm/sensors` 구독 → `POST /api/sensors/ingest`). 시뮬레이터는 브로커에만 발행합니다.
- **§6.3 상태가 DB·Actuator “보드”에 반영**되려면 역시 브라우저 MQTT가 §6.3 패턴을 구독 중이어야 합니다.
- 시뮬레이터 콘솔만으로 “발행·수신” 여부를 빠르게 확인할 수 있고, MQTTX와 역할이 비슷합니다.

## 환경 변수

### 브로커 URL·계정 (우선순위: 위에서 아래)

스크립트는 `dotenv`로 `web/.env.local`을 읽은 뒤 `process.env`를 사용합니다. **이미 셸에 설정된 변수는 `.env.local` 값으로 덮어쓰지 않습니다.**

| 용도 | 후보 키 (하나만 있어도 됨) |
|------|---------------------------|
| URL | `MQTT_URL` → `MQTT_BROKER_URL` → `NEXT_PUBLIC_MQTT_BROKER_URL` |
| 사용자명 | `MQTT_USERNAME` → `NEXT_PUBLIC_MQTT_USERNAME` |
| 비밀번호 | `MQTT_PASSWORD` → `NEXT_PUBLIC_MQTT_PASSWORD` |

HiveMQ WebSocket을 쓰는 경우 URL 예: `wss://<클러스터>.hivemq.cloud:8884/mqtt` (`web/.env.local`과 동일하면 됨).

### 기타

| 변수 | 설명 |
|------|------|
| `DOTENV_PATH` | 기본 `web/.env.local` 대신 불러올 env 파일 경로(절대·상대) |
| `MQTT_CLIENT_ID` | 기본값 `smartfarm-sim-node` |
| `SENSOR_INTERVAL_MS` | 센서 발행 주기(ms). 기본 `10000` |
| `ECHO_STATUS` | `0`이면 §6.3 상태 토픽 재발행 안 함. 그 외(미설정 포함)는 재발행 |

## 문제 해결

- **`[오류] 브로커 URL이 없습니다`**: `web/.env.local`에 `MQTT_BROKER_URL` 또는 `NEXT_PUBLIC_MQTT_BROKER_URL` 추가, 또는 PowerShell에서 `$env:MQTT_URL="wss://..."` 로 지정.
- **`[env] 파일 없음`**: 저장소 루트 구조가 맞는지 확인하거나 `DOTENV_PATH`로 `.env.local` 위치를 직접 지정.
- **대시보드에는 안 보이는데 시뮬 콘솔만 정상**: 브로커·토픽은 맞고, **브라우저 MQTT 미연결** 또는 **로그인·센서 소유** 불일치일 수 있음 → [`mqttHiveMQ.md`](./mqttHiveMQ.md)의 DB·인증 설명 참고.
