-- alert_settings / alert_logs — PRD §5.5–5.6 (plan 단계 10)
-- 기존 coreSchema 적용 후 Supabase SQL Editor에서 실행.

begin;

-- ---------------------------------------------------------------------------
-- alert_settings — 센서별 임계치(하한·상한)·활성 여부
-- ---------------------------------------------------------------------------
create table if not exists public.alert_settings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  sensor_id uuid not null references public.sensors (id) on delete cascade,
  min_value numeric,
  max_value numeric,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alert_settings_bounds_chk check (
    not enabled or min_value is not null or max_value is not null
  ),
  constraint alert_settings_min_max_chk check (
    min_value is null or max_value is null or min_value <= max_value
  )
);

create unique index if not exists alert_settings_sensor_id_uidx
  on public.alert_settings (sensor_id);

create index if not exists alert_settings_owner_idx
  on public.alert_settings (owner_id);

comment on table public.alert_settings is '센서별 임계치·알림 활성 — PRD §5.5';

-- ---------------------------------------------------------------------------
-- alert_logs — 임계치 초과 시 기록 (sensor_readings 와 연결)
-- ---------------------------------------------------------------------------
create table if not exists public.alert_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  alert_setting_id uuid references public.alert_settings (id) on delete set null,
  sensor_reading_id uuid references public.sensor_readings (id) on delete set null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists alert_logs_owner_created_idx
  on public.alert_logs (owner_id, created_at desc);

comment on table public.alert_logs is '알림(임계치 초과) 발생 이력 — PRD §5.6';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.alert_settings enable row level security;
alter table public.alert_logs enable row level security;

drop policy if exists "alert_settings_all_owner" on public.alert_settings;
create policy "alert_settings_all_owner"
  on public.alert_settings for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "alert_logs_select_owner" on public.alert_logs;
create policy "alert_logs_select_owner"
  on public.alert_logs for select
  using (owner_id = auth.uid());

drop policy if exists "alert_logs_insert_owner" on public.alert_logs;
create policy "alert_logs_insert_owner"
  on public.alert_logs for insert
  with check (owner_id = auth.uid());

commit;
