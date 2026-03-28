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
import { SENSOR_TYPE_FILTERS } from "@/lib/sensors/constants";
import {
  latestByType,
  type SensorReadingRow,
} from "@/lib/sensors/queryReadings";
import {
  MqttBrowserSettings,
  useMqttBrowser,
} from "@/components/dashboard/MqttBrowserBridge";
import { parseResponseBodyJson } from "@/lib/http/parseResponseBodyJson";

/** 테마 --chart-* 는 oklch 이므로 hsl() 로 감싸지 않음 (감싸면 무효 색 → 선 미표시) */
const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

/** 실시간(최근 1시간) 조회 구간·자동 폴링 간격 */
const LIVE_WINDOW_MS = 60 * 60 * 1000;
const LIVE_POLL_MS = 30 * 1000;

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

type SensorDashboardProps = {
  /** true: MQTT 블록 숨김(좌측 패널에 둘 때) */
  hideMqttSettings?: boolean;
  /** true: 측정 이력 전체 삭제 버튼 숨김(DB 탭 전용 테이블로 이동) */
  hideClearReadings?: boolean;
};

/** Sensor 영역 — 실시간(최근 1시간)·타입 필터·요약·라인 차트 (기간 지정은 DB 탭) */
export function SensorDashboard({
  hideMqttSettings = false,
  hideClearReadings = false,
}: SensorDashboardProps) {
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(
    () => new Set(SENSOR_TYPE_FILTERS.map((x) => x.type)),
  );
  const [rows, setRows] = useState<SensorReadingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** 측정 이력 삭제 성공 등 안내 */
  const [notice, setNotice] = useState<string | null>(null);
  const [clearingReadings, setClearingReadings] = useState(false);

  const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (selectedTypes.size === 0) {
      setError("센서 타입을 한 개 이상 선택해 주세요.");
      setRows([]);
      setLoading(false);
      return;
    }
    if (!silent) {
      setLoading(true);
    }
    if (!silent) {
      setError(null);
      setNotice(null);
    }
    const params = new URLSearchParams();
    const fromIso = new Date(Date.now() - LIVE_WINDOW_MS).toISOString();
    const toIso = new Date().toISOString();
    params.set("from", fromIso);
    params.set("to", toIso);
    if (selectedTypes.size < SENSOR_TYPE_FILTERS.length) {
      params.set("types", [...selectedTypes].join(","));
    }
    try {
      const res = await fetch(`/api/sensor-readings?${params.toString()}`, {
        credentials: "include",
      });
      const parsed = await parseResponseBodyJson<{
        rows?: SensorReadingRow[];
        error?: string;
      }>(res);
      if (!parsed.parseOk) {
        if (!silent) {
          setError(parsed.fallbackMessage);
          setRows([]);
        }
        return;
      }
      const json = parsed.data;
      if (!res.ok) {
        if (!silent) {
          setError(json.error ?? "데이터를 불러오지 못했습니다.");
          setRows([]);
        }
        return;
      }
      setRows(json.rows ?? []);
      setError(null);
    } catch {
      if (!silent) {
        setError("네트워크 오류가 발생했습니다.");
        setRows([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [selectedTypes]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const { registerCallbacks } = useMqttBrowser();

  /** MQTT 저장 시 차트 갱신 */
  useEffect(() => {
    registerCallbacks({
      onStored: () => void fetchData({ silent: true }),
    });
    return () => registerCallbacks({});
  }, [registerCallbacks, fetchData]);

  /** 주기적 재조회 — silent 로 차트 깜박임 방지 */
  useEffect(() => {
    const id = window.setInterval(() => {
      void fetchData({ silent: true });
    }, LIVE_POLL_MS);
    return () => window.clearInterval(id);
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

  function toggleType(type: string) {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  /** 본인 소유 센서의 sensor_readings 전부 삭제 */
  async function handleClearAllReadings() {
    if (
      !window.confirm(
        "본인 계정에 연결된 센서의 측정 이력(sensor_readings)을 모두 삭제합니다. 되돌릴 수 없습니다. 계속할까요?",
      )
    ) {
      return;
    }
    setClearingReadings(true);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/sensor-readings/clear", {
        method: "DELETE",
        credentials: "include",
      });
      const parsed = await parseResponseBodyJson<{
        ok?: boolean;
        deleted?: number;
        error?: string;
      }>(res);
      if (!parsed.parseOk) {
        setError(parsed.fallbackMessage);
        return;
      }
      const json = parsed.data;
      if (!res.ok) {
        setError(json.error ?? "삭제에 실패했습니다.");
        return;
      }
      const deleted = json.deleted ?? 0;
      await fetchData({ silent: false });
      setNotice(`측정 이력 ${deleted}건을 삭제했습니다.`);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setClearingReadings(false);
    }
  }

  return (
    <section className="dashboard-panel">
      <h2 className="text-base font-semibold tracking-tight">Sensor</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        온도·습도 등 센서 요약과 차트입니다. 최근 1시간 구간을 자동으로 갱신합니다.
        기간을 지정해 조회하려면 DB 탭을 이용하세요.
      </p>

      {!hideMqttSettings ? (
        <div className="mt-3">
          <MqttBrowserSettings />
        </div>
      ) : null}

      <div className="mt-4 space-y-4">
        <p className="text-muted-foreground text-xs leading-relaxed">
          최근 1시간 구간 · 약 {LIVE_POLL_MS / 1000}초마다 자동 조회 · MQTT로
          저장되면 즉시 반영
        </p>

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

        <div className="flex flex-wrap items-center justify-end gap-2">
          {!hideClearReadings ? (
            <Button
              type="button"
              variant="destructive"
              disabled={clearingReadings}
              onClick={() => void handleClearAllReadings()}
            >
              {clearingReadings ? "삭제 중…" : "측정 이력 전체 삭제"}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            onClick={() => void fetchData({ silent: false })}
          >
            다시 조회
          </Button>
        </div>
        {notice ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">
            {notice}
          </p>
        ) : null}
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
          className="mt-4 flex min-h-[120px] flex-col items-center justify-center rounded-xl border border-dashed border-cyan-500/20 bg-muted/25 px-4 py-8 text-center text-sm text-muted-foreground"
          role="status"
        >
          최근 1시간·선택 타입에 맞는 데이터가 없습니다.
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
                    className="rounded-xl border border-cyan-500/15 bg-muted/25 px-3 py-2 text-sm"
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
