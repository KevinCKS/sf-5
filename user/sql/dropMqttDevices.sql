-- (선택) 과거 mqtt_devices 테이블 제거 — 현재 스키마(coreSchema)에는 없음
-- Supabase SQL Editor에서 실행

begin;

drop table if exists public.mqtt_devices cascade;

commit;
