-- Smartfarm 핵심 스키마 (PRD §5, plan 단계 2)
-- 단일 농장 전제: farms 테이블 없음. 센서·액추는 사용자(profiles) 소유로 RLS.
-- Supabase → SQL Editor에서 전체 실행.
-- ※ 이미 예전 버전(farms 포함)을 적용한 DB는 백업 후 수동 정리하거나 새 프로젝트에 이 스크립트를 적용한다.

begin;

-- ---------------------------------------------------------------------------
-- 1) profiles — auth.users 와 1:1 프로필 (PRD §5.1 users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is '사용자 프로필 — PRD users, auth.users 1:1';

-- ---------------------------------------------------------------------------
-- 2) sensors — 메타정보 (PRD §5.2). 소유자 1명 = 단일 농장 전제
-- ---------------------------------------------------------------------------
create table if not exists public.sensors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  sensor_type text not null,
  unit text,
  zone_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sensors_owner_id_idx on public.sensors (owner_id);

comment on table public.sensors is '센서 메타 — owner_id=소유 사용자. 타입 예: temperature, humidity, ec, ph 등';

-- ---------------------------------------------------------------------------
-- 3) sensor_readings — 시계열 (PRD §5.3)
-- ---------------------------------------------------------------------------
create table if not exists public.sensor_readings (
  id uuid primary key default gen_random_uuid(),
  sensor_id uuid not null references public.sensors (id) on delete cascade,
  value numeric not null,
  recorded_at timestamptz not null default now()
);

create index if not exists sensor_readings_sensor_recorded_idx
  on public.sensor_readings (sensor_id, recorded_at desc);

comment on table public.sensor_readings is '센서 측정값 시계열';

-- ---------------------------------------------------------------------------
-- 4) actuator_controls — 제어 이력 (PRD §5.4)
-- ---------------------------------------------------------------------------
create table if not exists public.actuator_controls (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  actuator_key text not null,
  state text not null,
  recorded_at timestamptz not null default now(),
  triggered_by uuid references public.profiles (id) on delete set null,
  constraint actuator_controls_key_chk check (actuator_key in ('led', 'pump', 'fan1', 'fan2')),
  constraint actuator_controls_state_chk check (state in ('ON', 'OFF'))
);

create index if not exists actuator_controls_owner_recorded_idx
  on public.actuator_controls (owner_id, recorded_at desc);

comment on table public.actuator_controls is '액츄에이터 ON/OFF 이력 — owner_id=소유 사용자';

-- ---------------------------------------------------------------------------
-- 5) 신규 가입 시 profiles 자동 생성
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 6) RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.sensors enable row level security;
alter table public.sensor_readings enable row level security;
alter table public.actuator_controls enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (id = auth.uid());

-- sensors: 본인 소유만
drop policy if exists "sensors_all_owner" on public.sensors;
create policy "sensors_all_owner"
  on public.sensors for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- sensor_readings: 소속 sensor 의 owner 만
drop policy if exists "sensor_readings_select_via_sensor" on public.sensor_readings;
create policy "sensor_readings_select_via_sensor"
  on public.sensor_readings for select
  using (
    exists (
      select 1 from public.sensors s
      where s.id = sensor_readings.sensor_id and s.owner_id = auth.uid()
    )
  );

drop policy if exists "sensor_readings_insert_via_sensor" on public.sensor_readings;
create policy "sensor_readings_insert_via_sensor"
  on public.sensor_readings for insert
  with check (
    exists (
      select 1 from public.sensors s
      where s.id = sensor_readings.sensor_id and s.owner_id = auth.uid()
    )
  );

drop policy if exists "sensor_readings_update_via_sensor" on public.sensor_readings;
create policy "sensor_readings_update_via_sensor"
  on public.sensor_readings for update
  using (
    exists (
      select 1 from public.sensors s
      where s.id = sensor_readings.sensor_id and s.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.sensors s
      where s.id = sensor_readings.sensor_id and s.owner_id = auth.uid()
    )
  );

drop policy if exists "sensor_readings_delete_via_sensor" on public.sensor_readings;
create policy "sensor_readings_delete_via_sensor"
  on public.sensor_readings for delete
  using (
    exists (
      select 1 from public.sensors s
      where s.id = sensor_readings.sensor_id and s.owner_id = auth.uid()
    )
  );

-- actuator_controls: 본인 소유만
drop policy if exists "actuator_controls_all_owner" on public.actuator_controls;
create policy "actuator_controls_all_owner"
  on public.actuator_controls for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

commit;
