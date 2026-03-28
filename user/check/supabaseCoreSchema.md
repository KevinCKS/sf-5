# Supabase 핵심 스키마 적용 (plan 단계 2)

**단일 농장 전제:** `farms` 테이블 없음. 센서·액추는 `owner_id`(로그인 사용자 = `profiles.id`)로 소유한다.

## 1. SQL 실행

1. [Supabase Dashboard](https://supabase.com/dashboard) → 프로젝트 → **SQL Editor**.
2. `user/sql/coreSchema.sql` 내용을 **전체 복사**해 새 쿼리에 붙여 넣고 **Run** 한다.
3. 오류 없이 `Success` 면 적용 완료.

**이미 예전 스크립트(`farms` 포함)를 적용한 DB**는 테이블·정책이 충돌할 수 있다. 새 프로젝트에 적용하거나, 기존 데이터 백업 후 스키마를 정리한 뒤 실행한다.

## 2. Table Editor 확인

| 테이블 | 설명 |
|--------|------|
| `profiles` | PRD §5.1 users (auth 1:1) |
| `sensors` | 센서 메타 (`owner_id`) |
| `sensor_readings` | 시계열 |
| `actuator_controls` | 액추 이력 (`owner_id`) |
| `actuator_status` | 액추 **보고 상태** §6.3 (`owner_id`·`actuator_key`당 최신) |

**이미 `coreSchema.sql` 만 예전에 적용한 DB**에는 `user/sql/addActuatorStatusTable.sql` 을 SQL Editor에서 실행해 `actuator_status` 를 추가한다.

## 3. RLS·데이터 검증 (권장)

1. 테스트 사용자로 로그인(또는 Table Editor에서 해당 사용자로 보기).
2. `sensors`에 `owner_id` = 본인 `profiles.id` 로 행 삽입 → `sensor_readings` 삽입 가능 여부 확인.
3. `actuator_controls`에 `owner_id` = 본인 id 로 삽입.
4. `actuator_status`에 본인 `owner_id`·`actuator_key` 로 upsert 가능 여부 확인.
5. **다른 사용자**로는 위 행이 **보이지 않아야** 한다.

서비스 롤은 RLS를 우회하므로, 정책 검증은 **로그인 사용자(anon 키 아닌 JWT)** 기준으로 할 것.

## 4. 트리거 확인

신규 가입 시 `profiles` 자동 생성 여부 확인(`handle_new_user`).
