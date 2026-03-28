## 1. PRD(Product Requirements Doccument) 작성

```prompt
프로젝트의 전반적인 방향과 기능을 구체화하기 위해 주요 기능, 화면 구성, 기술 스택, 데이터 
구조를 포함한 PRD(제품 요구사항 정의서)를 작성해 주세요. 
문서는 실제 개발에 바로 활용할 수 있는 수준으로 구성하고, 
결과는 마크다운 형식으로 user/docs/prd.md 파일로 작성해 주세요.

1. 주요 기능
    1) 이메일/비밀번호 로그인 및 회원가입: Supabase Auth를 활용해 사용자 인증 기능 제공
    2) 센서 데이터 필터, 정렬 기능
        - 필터링: 센서 타입(온도/습도/조도/CO2/토양수분), 기간(일자/시간 범위) 선택
        - 정렬: 수집일시순(최신/과거), 센서 타입순, 값 기준(높은순/낮은순)
        - 센서값 표시: 레이블과 라인차트
    3) 액츄에이터 
        - 식물성장LED, Pump, FAN1, FAN2 제어를 위한 버튼(ON/OFF)
    4) MQTT 로 Arduino Uno R4 WiFi 보드와 센서, 액츄에이터 데이터 통신
        - MQTT broker: HiveMQ cloud 사용

2. 화면 구성
    1) 로그인/회원가입 화면: 사용자 인증 및 계정 관리
    2) 대시보드(메인) 화면
        - Sensor: 실시간(또는 최신) 센서 요약, 필터·정렬
        - Actuator: ON/OFF 제어 버튼
    
3. 사용 기술
    1) Next.js 15(App Router), TypeScript(strict 권장), Tailwind CSS, Shadcn/ui, 
      Supabase(Auth/DB), ESLint(Next/TS 규칙 기반)

4. DB table 구조(Supabase 활용)
    1) users: 사용자 프로필 관리(Supabase Auth와 1:1 연동)
    2) sensors: 센서(장비) 메타정보
    3) sensor_readings: 센서별 시계열 측정값
    4) actuator_controls: ON/OFF 제어 이력
    5) alert_settings(확장): 임계치 및 알림 설정
    6) alert_logs(확장): 알림 발생 이력

5. MQTT Topic / Payload
    1) Arduino Uno R4 WiFi 보드에서 센서값들을 위한 발행 Topic(웹 서비스화면에서는 구독)
        - 온도, 습도, EC, pH 값들을 JSON에 묶어 한번에 발행
        - 웹 화면에서 실시간 설정 가능
        - Topic 예) smartfarm/sensors
        - Payload 예) {
                "temp": 24.5,
                "humi": 62.0,
                "ec": 1.2,
                "ph": 6.1,
                "timestamp": "2026-03-28T12:34:56.000Z"
            }
    2) Arduino Uno R4 WiFi 보드에서 액츄에이터값들을 위한 구독 Topic(웹 서비스화면에서는 발행)
        - 식물성장LED, Pump, FAN1, FAN2 를 각각 구독
        - 웹 화면에서 실시간 설정 가능
        - Topic 예) 
            LED :  smartfarm/actuators/led
            Pump:  smartfarm/actuators/pump
            FAN1:  smartfarm/actuators/fan1
            FAN2:  smartfarm/actuators/fan2
        - Payload 예) {"state":"ON"}

6. 배포
    1) vercel에서 github 를 통한 CI/CD 를 적용

7. 환경 변수 관리
    1) local : Next 앱이 `web/`에 있으므로 로드 기준은 `web/.env.local`이다. 키 목록 초안·백업은 `user/.env.local`에 둘 수 있다(프로젝트 규칙). 실제 실행 시에는 `web/.env.local`에 맞춘다.
    2) 배포시 : Vercel 에서 관리
```
---


