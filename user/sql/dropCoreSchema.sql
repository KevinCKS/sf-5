-- coreSchema(및 예전 farms 버전)로 생성한 public 테이블·트리거·함수 제거
-- Supabase SQL Editor에서 실행. 삭제 후 user/sql/coreSchema.sql 로 다시 생성 가능.

begin;

-- auth 트리거가 함수를 참조하므로 먼저 제거
drop trigger if exists on_auth_user_created on auth.users;

-- 자식 테이블부터 (FK 순서)
drop table if exists public.sensor_readings cascade;
drop table if exists public.actuator_controls cascade;
drop table if exists public.sensors cascade;

-- 예전 스키마(farms) 사용 시
drop table if exists public.farms cascade;

-- 프로필 (auth.users 는 삭제하지 않음)
drop table if exists public.profiles cascade;

-- 트리거에서 쓰던 함수
drop function if exists public.handle_new_user() cascade;

commit;
