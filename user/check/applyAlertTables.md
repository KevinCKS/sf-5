# Alert 테이블 적용 (단계 10)

PRD §5.5 `alert_settings`, §5.6 `alert_logs` 를 Supabase에 반영합니다.

1. Supabase 대시보드 → **SQL Editor** → 새 쿼리.
2. 저장소의 `user/sql/addAlertTables.sql` 내용을 붙여 넣고 **실행**합니다.
3. **Table Editor**에서 `alert_settings`, `alert_logs` 가 생겼는지 확인합니다.
4. 앱에서 **Alert** 탭을 열어 임계치를 저장하고, **임계치 시뮬레이션**으로 알림 이력이 쌓이는지 확인합니다.

※ 기존 `coreSchema.sql` 이 이미 적용된 프로젝트에 **추가**로 실행하는 스크립트입니다.
