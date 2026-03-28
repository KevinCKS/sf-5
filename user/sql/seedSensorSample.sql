-- 센서·측정 샘플 (단계 5 테스트) — owner 이메일: cks1203316@gmail.com (Supabase SQL Editor에서 실행)
-- 타입: 온도·습도·EC·pH (PRD/MQTT payload 와 맞춤)

-- 1) 데모 센서 4종 (같은 sensor_type 이 이미 있으면 건너뜀)
insert into public.sensors (owner_id, name, sensor_type, unit)
select p.id, x.name, x.sensor_type, x.unit
from public.profiles p
join auth.users u on u.id = p.id
cross join (
  values
    ('데모 온도', 'temperature', '°C'),
    ('데모 습도', 'humidity', '%'),
    ('데모 EC', 'ec', 'mS/cm'),
    ('데모 pH', 'ph', 'pH')
) as x(name, sensor_type, unit)
where u.email = 'cks1203316@gmail.com'
  and not exists (
    select 1 from public.sensors s where s.owner_id = p.id and s.sensor_type = x.sensor_type
  );

-- 2) 시계열
insert into public.sensor_readings (sensor_id, value, recorded_at)
select s.id, v.val, v.ts::timestamptz
from public.sensors s
join auth.users u on u.id = s.owner_id
cross join (
  values
    (22.5, now() - interval '3 days'),
    (23.1, now() - interval '2 days'),
    (21.8, now() - interval '1 day'),
    (22.0, now() - interval '6 hours')
) as v(val, ts)
where u.email = 'cks1203316@gmail.com' and s.sensor_type = 'temperature';

insert into public.sensor_readings (sensor_id, value, recorded_at)
select s.id, v.val, v.ts::timestamptz
from public.sensors s
join auth.users u on u.id = s.owner_id
cross join (
  values
    (55.0, now() - interval '3 days'),
    (58.0, now() - interval '1 day'),
    (59.0, now() - interval '6 hours')
) as v(val, ts)
where u.email = 'cks1203316@gmail.com' and s.sensor_type = 'humidity';

insert into public.sensor_readings (sensor_id, value, recorded_at)
select s.id, v.val, v.ts::timestamptz
from public.sensors s
join auth.users u on u.id = s.owner_id
cross join (
  values
    (1.1, now() - interval '2 days'),
    (1.2, now() - interval '1 day'),
    (1.15, now() - interval '6 hours')
) as v(val, ts)
where u.email = 'cks1203316@gmail.com' and s.sensor_type = 'ec';

insert into public.sensor_readings (sensor_id, value, recorded_at)
select s.id, v.val, v.ts::timestamptz
from public.sensors s
join auth.users u on u.id = s.owner_id
cross join (
  values
    (6.2, now() - interval '2 days'),
    (6.1, now() - interval '1 day'),
    (6.3, now() - interval '6 hours')
) as v(val, ts)
where u.email = 'cks1203316@gmail.com' and s.sensor_type = 'ph';
