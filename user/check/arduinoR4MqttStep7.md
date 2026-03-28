# 단계 7 검증 — Arduino UNO R4 WiFi · MQTT 토픽·JSON 정합

PRD §6, `web/lib/mqtt/allowlist.ts` 와 동일한 문자열을 사용합니다.

## 스케치 위치

- 폴더: `user/script/SmartfarmMqttR4WiFi/`
- `arduino_secrets.h.example` → 같은 폴더에 **`arduino_secrets.h` 로 복사** 후 WiFi·HiveMQ 자격 증명 입력(복사본은 `.gitignore`로 커밋 제외 권장).

## Arduino IDE 준비

1. 보드: **Arduino UNO R4 WiFi**
2. 라이브러리 매니저: **PubSubClient** (Nick O’Leary)
3. 업로드 후 시리얼 모니터 **115200** baud

## 브로커(HiveMQ Cloud)

- TLS MQTT: 포트 **8883**, 호스트는 대시보드에 표시된 클러스터 호스트만(접두사 `mqtts://` 없음).
- WiFi 모듈 펌웨어가 오래되면 `WiFiSSLClient` 연결이 실패할 수 있음 → IDE **도구 → WiFi 펌웨어 업데이트** 등 공식 안내 참고.

## 동작 요약

| 항목 | 내용 |
|------|------|
| 발행 토픽 | `smartfarm/sensors` |
| 발행 JSON | `temp`, `humi`, `ec`, `ph`, `timestamp` — 보드는 플레이스홀더 `"-"` 만 보냄(NTP 없음). DB 시각은 대시보드 브리지가 브라우저 시각으로 설정 |
| 구독 토픽 | `smartfarm/actuators/led`, `…/pump`, `…/fan1`, `…/fan2` |
| 발행(§6.3) | 명령 수신 후 `smartfarm/actuators/status/{led|pump|fan1|fan2}` 로 `{"state":"ON"|"OFF"}` 재발행 — 대시보드 브리지·`actuator_status` 와 정합 |
| 주기 발행 | 약 15초마다 자동(고정 더미 값) |
| 시리얼 | `p` — 즉시 1회 발행, `t23.5` — temp 덮어쓰기, `h` — 도움말 |

## 교차 검증 (단계 6·MQTTX)

### 센서 → DB(브라우저 경로)

1. 웹 `npm run dev`, 대시보드 로그인 후 **MQTT 연결**.
2. 보드가 `smartfarm/sensors` 로 발행하는 동안 MQTTX로도 동일 토픽을 구독해 **JSON이 동일 규약**인지 확인.
3. Supabase `sensor_readings` 또는 대시보드 차트에 **로그인 사용자·시드된 `sensors` 소유**가 맞을 때만 반영되는지 확인.

### 액추 → 보드 시리얼

1. MQTTX에서 토픽 `smartfarm/actuators/led`(또는 pump, fan1, fan2)로 페이로드 `{"state":"ON"}` 발행.
2. 보드 시리얼에 `[ACT] smartfarm/actuators/led {"state":"ON"}` 형태로 수신되는지 확인.
3. (스케치 §6.3 포함 시) 시리얼에 `[STATUS] smartfarm/actuators/status/led` 등 발행 로그가 이어지는지, 대시보드 **MQTT 연결** 상태에서 Actuator **보드** 표시가 갱신되는지 확인.

## 문제 시

- `[MQTT] 연결 실패 rc=…` → 호스트·포트·사용자·비밀번호·TLS(8883) 확인.
