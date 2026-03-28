"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SENSOR_SORT_OPTIONS,
  SENSOR_TYPE_FILTERS,
  type SensorSortId,
} from "@/lib/sensors/constants";
import {
  latestByType,
  type SensorReadingRow,
} from "@/lib/sensors/queryReadings";

/** 테마 --chart-* 는 oklch 이므로 hsl() 로 감싸지 않음 (감싸면 무효 색 → 선 미표시) */
const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

/** 10분 단위 분 옵션 (네이티브 datetime-local 은 step UI 를 무시하는 경우가 많아 Select 로 고정) */
const MINUTES_10 = [0, 10, 20, 30, 40, 50] as const;
const HOURS_0_23 = Array.from({ length: 24 }, (_, i) => i);

/** datetime-local 기본값 — 7일 전 ~ 지금 (분은 10분 단위로 내림) */
function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 7);
  return {
    from: sliceLocalDateTime(from),
    to: sliceLocalDateTime(to),
  };
}

function sliceLocalDateTime(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const x = new Date(d);
  const m = Math.floor(x.getMinutes() / 10) * 10;
  x.setMinutes(m, 0, 0);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

/** "YYYY-MM-DDTHH:mm" ↔ 날짜·시·분 (분은 항상 10분 격자로 맞춤) */
function parseLocalDateTimeParts(s: string): {
  date: string;
  hour: number;
  minute: number;
} {
  const pad = (n: number) => String(n).padStart(2, "0");
  const m = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!m) {
    const d = new Date();
    const floored = Math.floor(d.getMinutes() / 10) * 10;
    d.setMinutes(floored, 0, 0);
    return {
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      hour: d.getHours(),
      minute: floored,
    };
  }
  const date = m[1];
  const hour = Math.min(23, Math.max(0, parseInt(m[2], 10)));
  const rawMin = parseInt(m[3], 10);
  const minute = Math.min(
    50,
    Math.floor((Number.isFinite(rawMin) ? rawMin : 0) / 10) * 10,
  );
  return { date, hour, minute };
}

function composeLocalDateTimeString(
  date: string,
  hour: number,
  minute: number,
): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = Math.min(23, Math.max(0, hour));
  const safeMin = MINUTES_10.includes(minute as (typeof MINUTES_10)[number])
    ? minute
    : Math.floor(minute / 10) * 10;
  return `${date}T${pad(h)}:${pad(safeMin)}`;
}

/** 시계열 → Recharts용 넓은 형식(타입별 컬럼) */
function pivotChartRows(rows: SensorReadingRow[], types: string[]) {
  const activeTypes = types.filter((t) => rows.some((r) => r.sensor_type === t));
  if (activeTypes.length === 0) return [];

  const times = [
    ...new Set(
      rows
        .filter((r) => activeTypes.includes(r.sensor_type))
        .map((r) => r.recorded_at),
    ),
  ].sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime(),
  );

  return times.map((t) => {
    // 결측은 NaN 대신 null — Recharts Tooltip 이 NaN을 렌더링하면 React 오류 발생
    const point: Record<string, string | number | null> = {
      time: t,
      timeLabel: new Date(t).toLocaleString("ko-KR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    for (const ty of activeTypes) {
      const hit = rows.find((r) => r.recorded_at === t && r.sensor_type === ty);
      point[ty] = hit ? hit.value : null;
    }
    return point;
  });
}

/** Sensor 영역 — 필터·정렬·요약·라인 차트 */
export function SensorDashboard() {
  const { from: defFrom, to: defTo } = useMemo(() => defaultRange(), []);
  const [from, setFrom] = useState(defFrom);
  const [to, setTo] = useState(defTo);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(
    () => new Set(SENSOR_TYPE_FILTERS.map((x) => x.type)),
  );
  const [sort, setSort] = useState<SensorSortId>("recorded_at_desc");
  const [rows, setRows] = useState<SensorReadingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (selectedTypes.size === 0) {
      setError("센서 타입을 한 개 이상 선택해 주세요.");
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("from", new Date(from).toISOString());
    params.set("to", new Date(to).toISOString());
    params.set("sort", sort);
    if (selectedTypes.size < SENSOR_TYPE_FILTERS.length) {
      params.set("types", [...selectedTypes].join(","));
    }
    try {
      const res = await fetch(`/api/sensor-readings?${params.toString()}`, {
        credentials: "include",
      });
      const json = (await res.json()) as {
        rows?: SensorReadingRow[];
        error?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "데이터를 불러오지 못했습니다.");
        setRows([]);
        return;
      }
      setRows(json.rows ?? []);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [from, to, sort, selectedTypes]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  /** 차트 시리즈 — 선택 타입 중 실제 데이터가 있는 것만 */
  const typesList = useMemo(() => {
    const sel = [...selectedTypes];
    const present = new Set(rows.map((r) => r.sensor_type));
    return sel.filter((t) => present.has(t));
  }, [selectedTypes, rows]);

  const chartData = useMemo(
    () => pivotChartRows(rows, typesList),
    [rows, typesList],
  );
  const latest = useMemo(() => latestByType(rows), [rows]);

  const fromParts = useMemo(() => parseLocalDateTimeParts(from), [from]);
  const toParts = useMemo(() => parseLocalDateTimeParts(to), [to]);

  const dateInputClass =
    "border-input bg-background ring-offset-background focus-visible:ring-ring h-9 min-w-[142px] rounded-md border px-3 py-1 text-sm shadow-sm focus-visible:ring-2 focus-visible:outline-none";

  function toggleType(type: string) {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  return (
    <section className="flex flex-col rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
      <h2 className="text-base font-semibold tracking-tight">Sensor</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        온도·습도 등 센서 요약과 차트입니다. 기간·타입·정렬을 바꾼 뒤 적용하세요.
      </p>

      <div className="mt-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label id="sensor-from-label">시작 (일시)</Label>
            <div
              className="flex flex-wrap items-center gap-2"
              role="group"
              aria-labelledby="sensor-from-label"
            >
              <input
                id="sensor-from-date"
                type="date"
                value={fromParts.date}
                onChange={(e) => {
                  const p = parseLocalDateTimeParts(from);
                  setFrom(
                    composeLocalDateTimeString(
                      e.target.value,
                      p.hour,
                      p.minute,
                    ),
                  );
                }}
                className={dateInputClass}
              />
              <Select
                value={String(fromParts.hour)}
                onValueChange={(v) => {
                  const p = parseLocalDateTimeParts(from);
                  setFrom(
                    composeLocalDateTimeString(p.date, parseInt(v, 10), p.minute),
                  );
                }}
              >
                <SelectTrigger className="h-9 w-[92px]" aria-label="시작 시각 시">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS_0_23.map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {String(h).padStart(2, "0")}시
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(fromParts.minute)}
                onValueChange={(v) => {
                  const p = parseLocalDateTimeParts(from);
                  setFrom(
                    composeLocalDateTimeString(
                      p.date,
                      p.hour,
                      parseInt(v, 10),
                    ),
                  );
                }}
              >
                <SelectTrigger className="h-9 w-[92px]" aria-label="시작 시각 분 (10분 단위)">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MINUTES_10.map((min) => (
                    <SelectItem key={min} value={String(min)}>
                      {String(min).padStart(2, "0")}분
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label id="sensor-to-label">종료 (일시)</Label>
            <div
              className="flex flex-wrap items-center gap-2"
              role="group"
              aria-labelledby="sensor-to-label"
            >
              <input
                id="sensor-to-date"
                type="date"
                value={toParts.date}
                onChange={(e) => {
                  const p = parseLocalDateTimeParts(to);
                  setTo(
                    composeLocalDateTimeString(
                      e.target.value,
                      p.hour,
                      p.minute,
                    ),
                  );
                }}
                className={dateInputClass}
              />
              <Select
                value={String(toParts.hour)}
                onValueChange={(v) => {
                  const p = parseLocalDateTimeParts(to);
                  setTo(
                    composeLocalDateTimeString(p.date, parseInt(v, 10), p.minute),
                  );
                }}
              >
                <SelectTrigger className="h-9 w-[92px]" aria-label="종료 시각 시">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS_0_23.map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {String(h).padStart(2, "0")}시
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(toParts.minute)}
                onValueChange={(v) => {
                  const p = parseLocalDateTimeParts(to);
                  setTo(
                    composeLocalDateTimeString(
                      p.date,
                      p.hour,
                      parseInt(v, 10),
                    ),
                  );
                }}
              >
                <SelectTrigger className="h-9 w-[92px]" aria-label="종료 시각 분 (10분 단위)">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MINUTES_10.map((min) => (
                    <SelectItem key={min} value={String(min)}>
                      {String(min).padStart(2, "0")}분
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>센서 타입</Label>
          <div className="flex flex-wrap gap-3">
            {SENSOR_TYPE_FILTERS.map(({ type, label }) => (
              <label
                key={type}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedTypes.has(type)}
                  onChange={() => toggleType(type)}
                  className="accent-primary h-4 w-4 rounded border"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-1.5 sm:min-w-[220px]">
            <Label>정렬</Label>
            <Select
              value={sort}
              onValueChange={(v) => setSort(v as SensorSortId)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SENSOR_SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="secondary" onClick={() => void fetchData()}>
            다시 조회
          </Button>
        </div>
      </div>

      {loading ? (
        <div
          className="mt-4 flex min-h-[160px] items-center justify-center gap-2 text-muted-foreground"
          role="status"
        >
          <Loader2 className="h-5 w-5 animate-spin" />
          불러오는 중…
        </div>
      ) : null}

      {!loading && error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <div
          className="mt-4 flex min-h-[120px] flex-col items-center justify-center rounded-md border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground"
          role="status"
        >
          이 기간·조건에 맞는 센서 데이터가 없습니다. DB에 샘플을 넣었는지 확인해
          주세요.
        </div>
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {SENSOR_TYPE_FILTERS.filter((f) => latest.has(f.type)).map(
              ({ type, label }) => {
                const v = latest.get(type);
                if (!v) return null;
                return (
                  <div
                    key={type}
                    className="rounded-md border bg-muted/20 px-3 py-2 text-sm"
                  >
                    <span className="text-muted-foreground">{label}</span>
                    <div className="font-semibold tabular-nums">
                      {v.value}
                      {v.unit ? (
                        <span className="text-muted-foreground font-normal">
                          {" "}
                          {v.unit}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              },
            )}
          </div>

          {/* 타입마다 별도 라인차트 — Y축·단위 혼합 왜곡 방지 */}
          <div className="mt-4 flex w-full min-w-0 flex-col gap-6">
            {typesList.map((ty, i) => {
              const label =
                SENSOR_TYPE_FILTERS.find((f) => f.type === ty)?.label ?? ty;
              const unit = rows.find((r) => r.sensor_type === ty)?.unit;
              return (
                <div key={ty} className="min-w-0">
                  <p className="mb-1 text-sm font-medium text-foreground">
                    {label}
                    {unit ? (
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        ({unit})
                      </span>
                    ) : null}
                  </p>
                  <div className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={chartData}
                        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-muted"
                        />
                        <XAxis
                          dataKey="timeLabel"
                          tick={{ fontSize: 11 }}
                          interval="preserveStartEnd"
                        />
                        <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                        <Tooltip contentStyle={{ fontSize: 12 }} />
                        <Line
                          type="monotone"
                          dataKey={ty}
                          name={label}
                          stroke={CHART_COLORS[i % CHART_COLORS.length]}
                          dot={false}
                          connectNulls
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            센서 타입마다 차트가 분리되어, 각각의 Y축이 해당 측정값 범위에 맞춰
            표시됩니다.
          </p>
        </>
      ) : null}
    </section>
  );
}
