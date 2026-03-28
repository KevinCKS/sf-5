-- actuator_status — PRD §6.3 보드가 보고한 액추 실제 상태(사용자별 최신 1행/키)
-- 기존 coreSchema 적용 후 Supabase SQL Editor에서 실행.

begin;

create table if not exists public.actuator_status (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  actuator_key text not null,
  state text not null,
  updated_at timestamptz not null default now(),
  primary key (owner_id, actuator_key),
  constraint actuator_status_key_chk check (actuator_key in ('led', 'pump', 'fan1', 'fan2')),
  constraint actuator_status_state_chk check (state in ('ON', 'OFF'))
);

create index if not exists actuator_status_owner_updated_idx
  on public.actuator_status (owner_id, updated_at desc);

comment on table public.actuator_status is '액추 실제 상태(보드 §6.3 발행) — owner_id당 actuator_key별 최신';

alter table public.actuator_status enable row level security;

drop policy if exists "actuator_status_all_owner" on public.actuator_status;
create policy "actuator_status_all_owner"
  on public.actuator_status for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

commit;
