
## 1. Project Rules 설정
### 1-1 프로젝트 규칙 설정
```prompt
1. 프로젝트 폴더에 .cursor/rules/project-rule.mdc 파일을 생성해줘

2. 이 파일에는 "Smartfarm Web Service"를 위해서 아래의 내용으로 작성할 것이야

3. 내용
  (1) 프로젝트 특성
    1) Next.js 15 App Router 기반의 웹 애플리케이션
    2) 사용자 경험 최우선: 로딩/빈상태/오류 상태 UI를 모두 제공하고 상호작용 지연을 최소화
    3) 오류처리 절차: 서버/클라이언트 예외를 포착하고, 사용자에게 한글로 친절한 메시지 제공
       (개발환경에서는 상세로그 출력)
  (2) 기술 스택
    1) Next.js 15(App Router)
    2) TypeScript(필수, strict권장)
    3) Tailwind CSS(스타일링)
    4) Shadcn/ui(UI 컴포넌트)
    5) Supabase(Authentication, DB)
    6) ESLint(Next/TS 규칙 기반)
  (3) 코팅 스타일
    1) 함수형 컴포넌트를 기본
    2) 컴포넌트 파일명은 파스칼 케이스(예: SensorDashboard.tsx)
    3) 한글 주석 필수
      예) 새·수정 함수·컴포넌트 상단에 한 줄 요약(한글)
    4) ESLint 규칙을 준수
  (4) 기타
    1) 사용자가 직접적으로 다루는 파일들은 user 폴더에 저장
      예) 테스트 실행을 위한 script 파일들은 user/script/mqttTest.js
      예) Supabase DB생성등을 위한 SQL적용 파일들은 user/sql/createSensorTable.sql
    2) 사용자가 해야할 일들은 markdown문서로 생성
      예) Supabase dashboard 에서 사용자가 해야할 절차는 user/check/supabaseSetting.md
    3) Project rules와 User rules 충돌 시 “User Rule 우선”
```
<br><br>

### 1-2 Cursor AI와 프로젝트 규칙 재확인
```prompt
이 프로젝트의 규칙이 커서의 규칙 작성 원칙에 맞춰 잘 작성되었는지 확인해줘
```
---

