"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
  memo,
} from "react";
import dynamic from "next/dynamic";
import { Loader2, RefreshCw, Thermometer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SENSOR_TYPE_FILTERS } from "@/lib/sensors/constants";
import {
  latestAndUnitByTypeFromRows,
  sameSensorReadingRows,
  type SensorReadingRow,
} from "@/lib/sensors/queryReadings";
import {
  MqttBrowserSettings,
  useMqttConnectionCore,
} from "@/components/dashboard/MqttBrowserBridge";
import { SensorTypeCheckbox } from "@/components/dashboard/SensorTypeCheckbox";
import type { SensorChartPoint } from "@/components/dashboard/SensorLiveChartsBlock";
import { dashboardFetchInit } from "@/lib/http/dashboardFetchInit";
import { parseResponseBodyJson } from "@/lib/http/parseResponseBodyJson";
import { requestClearAllSensorReadings } from "@/lib/http/sensorReadingsClient";
import { cn } from "@/lib/utils";

/** Recharts 청크 지연 로드 — 메인 번들에서 차트 라이브러리 제외 */
const SensorLiveChartsBlock = dynamic(
  () =>
    import("@/components/dashboard/SensorLiveChartsBlock").then(
      (m) => m.SensorLiveChartsBlock,
    ),
  {
    loading: () => (
      <div
        className="mt-4 flex min-h-[220px] items-center justify-center gap-2 text-muted-foreground text-sm"
        role="status"
      >
        <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
        차트 영역을 불러오는 중…
      </div>
    ),
    ssr: false,
  },
);

/** 실시간(최근 1시간) 조회 구간·자동 폴링 간격 */
const LIVE_WINDOW_MS = 60 * 60 * 1000;
const LIVE_POLL_MS = 30 * 1000;

/** API 응답에 넓은 구간이 섞여도 차트·요약은 [지금−1h, 지금]만 사용 */
function filterRowsToLiveWindow(
  rows: SensorReadingRow[],
  windowMs: number,
): SensorReadingRow[] {
  const now = Date.now();
  const start = now - windowMs;
  return rows.filter((r) => {
    const t = new Date(r.recorded_at).getTime();
    return !Number.isNaN(t) && t >= start && t <= now;
  });
}

/** 차트 X축·툴팁용 시각 — 짧게 24시간제 시:분만 */
function formatChartTimeLabelForAxis(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Recharts 포인트·Intl 포맷 횟수 상한 — 초당 다건 적재 시에도 메인 스레드 부담 완화 */
const MAX_CHART_TIME_POINTS = 400;

/** ISO 시각 축 희소 샘플(시계열 순서 유지, 끝 시각 포함) */
function sampleSortedIsoTimes(times: string[]): string[] {
  if (times.length <= MAX_CHART_TIME_POINTS) return times;
  const stride = Math.ceil(times.length / MAX_CHART_TIME_POINTS);
  const out: string[] = [];
  for (let i = 0; i < times.length; i += stride) {
    out.push(times[i]!);
  }
  const last = times[times.length - 1]!;
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

/** rows에 실제로 존재하는 타입만 담긴 목록을 넘길 것 (호출부 typesList가 보장) — 한 번 순회로 피벗 */
function pivotChartRows(
  rows: SensorReadingRow[],
  types: string[],
): SensorChartPoint[] {
  if (types.length === 0) return [];

  const activeTypes = types;
  const activeTypeSet = new Set(activeTypes);
  /** 시각 → 타입 → 값 — 복합 문자열 키 할당 없이 조회 */
  const valueByTime = new Map<string, Map<string, number>>();
  const timeSet = new Set<string>();
  for (const r of rows) {
    if (!activeTypeSet.has(r.sensor_type)) continue;
    timeSet.add(r.recorded_at);
    let inner = valueByTime.get(r.recorded_at);
    if (!inner) {
      inner = new Map();
      valueByTime.set(r.recorded_at, inner);
    }
    if (!inner.has(r.sensor_type)) {
      inner.set(r.sensor_type, r.value);
    }
  }

  // ISO8601 문자열은 사전순 = 시계열 순서 — localeCompare 대비 비용 완화
  const sorted = [...timeSet].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const times = sampleSortedIsoTimes(sorted);

  return times.map((t) => {
    // 결측은 NaN 대신 null — Recharts Tooltip 이 NaN을 렌더링하면 React 오류 발생
    const inner = valueByTime.get(t);
    const point: Record<string, string | number | null> = {
      time: t,
      timeLabel: formatChartTimeLabelForAxis(t),
    };
    for (const ty of activeTypes) {
      const v = inner?.get(ty);
      point[ty] = v !== undefined ? v : null;
    }
    return point;
  });
}

type SensorDashboardProps = {
  /** true: MQTT 블록 숨김(좌측 패널에 둘 때) */
  hideMqttSettings?: boolean;
  /** true: 측정 이력 전체 삭제 버튼 숨김(DB 탭 전용 테이블로 이동) */
  hideClearReadings?: boolean;
  /** true: 대시보드 홈 2열 배치용 — 필터·차트 높이 축소 */
  compactHomeLayout?: boolean;
};

type SensorDashboardFilterBlockProps = {
  hideClearReadings: boolean;
  clearingReadings: boolean;
  onClearReadingsClick: () => void;
  refetchData: () => void;
  notice: string | null;
  selectedTypes: Set<string>;
  toggleType: (type: string) => void;
  compact?: boolean;
};

/** 타입 필터·조회 버튼 — rows/MQTT 힌트만 바뀔 때 체크박스·버튼 DOM 재생성 생략(Context 없음) */
const SensorDashboardFilterBlock = memo(function SensorDashboardFilterBlock({
  hideClearReadings,
  clearingReadings,
  onClearReadingsClick,
  refetchData,
  notice,
  selectedTypes,
  toggleType,
  compact = false,
}: SensorDashboardFilterBlockProps) {
  return (
    <div
      className={cn(
        compact ? "mt-2 space-y-2" : "mt-4 space-y-4",
        "dashboard-nest-toolbar",
        compact && "dashboard-nest-toolbar--compact",
      )}
    >
      {/* 체크박스·다시 조회 — compact 시 한 줄·소형 */}
      <div
        className={cn(
          "flex min-w-0 items-center",
          compact ? "gap-2" : "gap-3",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 flex-1 flex-wrap content-center items-center",
            compact ? "gap-x-2 gap-y-1" : "gap-x-3 gap-y-2",
          )}
        >
          {SENSOR_TYPE_FILTERS.map(({ type, label }) => (
            <SensorTypeCheckbox
              key={type}
              type={type}
              label={label}
              checked={selectedTypes.has(type)}
              onToggle={toggleType}
              compact={compact}
            />
          ))}
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={refetchData}
          className={cn(
            "shrink-0 font-normal",
            compact
              ? "h-6 min-h-0 gap-0.5 px-2 text-[11px] [&_svg]:size-3"
              : "h-7 gap-1 px-2.5 text-sm [&_svg]:size-3.5",
          )}
        >
          <RefreshCw className="shrink-0" aria-hidden />
          다시 조회
        </Button>
      </div>

      {!hideClearReadings ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="destructive"
            disabled={clearingReadings}
            onClick={onClearReadingsClick}
          >
            {clearingReadings ? (
              "삭제 중…"
            ) : (
              <>
                <Trash2 className="mr-1.5 size-4 shrink-0" aria-hidden />
                측정 이력 전체 삭제
              </>
            )}
          </Button>
        </div>
      ) : null}
      {notice ? (
        <p
          className="text-sm text-emerald-700 dark:text-emerald-400"
          role="status"
        >
          {notice}
        </p>
      ) : null}
    </div>
  );
});

/** Sensor 영역 — 실시간(최근 1시간)·타입 필터·요약·라인 차트 (기간 지정은 DB 탭) */
export function SensorDashboard({
  hideMqttSettings = false,
  hideClearReadings = false,
  compactHomeLayout = false,
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

  /** 빠른 필터 변경 시 이전 요청 취소·stale 응답 무시 */
  const fetchSeqRef = useRef(0);
  const fetchAbortRef = useRef<AbortController | null>(null);

  /** 타입 필터는 ref로 읽어 fetchData 의존성을 고정 — 폴링·MQTT 콜백 재등록·인터벌 리셋 방지 */
  const selectedTypesRef = useRef(selectedTypes);
  selectedTypesRef.current = selectedTypes;

  useEffect(() => {
    return () => {
      fetchAbortRef.current?.abort();
    };
  }, []);

  const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    const selectedTypes = selectedTypesRef.current;
    if (selectedTypes.size === 0) {
      setError("센서 타입을 한 개 이상 선택해 주세요.");
      setRows([]);
      setLoading(false);
      return;
    }
    const seq = ++fetchSeqRef.current;
    fetchAbortRef.current?.abort();
    const ac = new AbortController();
    fetchAbortRef.current = ac;

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
      const res = await fetch(
        `/api/sensor-readings?${params.toString()}`,
        dashboardFetchInit(ac.signal, { silent }),
      );
      if (seq !== fetchSeqRef.current) return;
      const parsed = await parseResponseBodyJson<{
        rows?: SensorReadingRow[];
        error?: string;
      }>(res);
      if (seq !== fetchSeqRef.current) return;
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
      const nextRows = json.rows ?? [];
      if (silent) {
        // 폴링·MQTT 백그라운드 갱신은 전환으로 묶어 차트·메인 스레드 반응성 유지
        startTransition(() => {
          setRows((prev) =>
            sameSensorReadingRows(prev, nextRows) ? prev : nextRows,
          );
          setError(null);
        });
      } else {
        setRows(nextRows);
        setError(null);
      }
    } catch {
      if (seq !== fetchSeqRef.current) return;
      if (ac.signal.aborted) return;
      if (!silent) {
        setError("네트워크 오류가 발생했습니다.");
        setRows([]);
      }
    } finally {
      if (seq === fetchSeqRef.current && !silent) {
        setLoading(false);
      }
    }
  }, []);

  /** 마운트·타입 필터 변경 시에만 전체 조회( fetchData 는 안정 참조) */
  useEffect(() => {
    void fetchData();
  }, [fetchData, selectedTypes]);

  const { registerCallbacks } = useMqttConnectionCore();

  /** MQTT 저장 시 차트 갱신 */
  useEffect(() => {
    registerCallbacks({
      onStored: () => void fetchData({ silent: true }),
    });
    return () => registerCallbacks({});
  }, [registerCallbacks, fetchData]);

  /** 주기적 재조회 — 백그라운드 탭에서는 스킵해 네트워크·CPU 절약, 복귀 시 한 번 갱신 */
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      void fetchData({ silent: true });
    };
    const id = window.setInterval(tick, LIVE_POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void fetchData({ silent: true });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchData]);

  /** 화면에 쓰는 행만 최근 1시간으로 제한(API와 동일 창을 클라이언트에서도 보장) */
  const rowsInLiveWindow = useMemo(
    () => filterRowsToLiveWindow(rows, LIVE_WINDOW_MS),
    [rows],
  );

  /** 요약·단위·typesPresent — rows 단일 순회(latestAndUnitByTypeFromRows) */
  const { latest, unitByType, typesPresent } = useMemo(
    () => latestAndUnitByTypeFromRows(rowsInLiveWindow),
    [rowsInLiveWindow],
  );

  /** 차트 시리즈 — 선택 타입 중 실제 데이터가 있는 것만(typesPresent 재사용으로 rows 재순회 생략) */
  const typesList = useMemo(
    () => [...selectedTypes].filter((t) => typesPresent.has(t)),
    [selectedTypes, typesPresent],
  );

  const chartData = useMemo(
    () => pivotChartRows(rowsInLiveWindow, typesList),
    [rowsInLiveWindow, typesList],
  );
  /** 폴링 등 빠른 연속 갱신 시 차트만 낮은 우선순위로 반영 — 입력·요약은 즉시 */
  const deferredChartData = useDeferredValue(chartData);

  /** 타입 체크 핸들러 참조 고정 — 자식·리스트 최적화에 유리 */
  const toggleType = useCallback((type: string) => {
    // 차트·피벗 재계산을 전환으로 묶어 체크박스 클릭 반응을 우선 처리
    startTransition(() => {
      setSelectedTypes((prev) => {
        const next = new Set(prev);
        if (next.has(type)) next.delete(type);
        else next.add(type);
        return next;
      });
    });
  }, []);

  /** 다시 조회 버튼 — 참조 고정으로 하위·이벤트 바인딩 비용 완화 */
  const refetchData = useCallback(() => {
    void fetchData({ silent: false });
  }, [fetchData]);

  /** 본인 소유 센서의 sensor_readings 전부 삭제 */
  const handleClearAllReadings = useCallback(async () => {
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
      const result = await requestClearAllSensorReadings();
      if (!result.ok) {
        setError(result.errorMessage);
        return;
      }
      await fetchData({ silent: false });
      setNotice(`측정 이력 ${result.deleted}건을 삭제했습니다.`);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setClearingReadings(false);
    }
  }, [fetchData]);

  const onClearReadingsClick = useCallback(() => {
    void handleClearAllReadings();
  }, [handleClearAllReadings]);

  return (
    <section
      className={cn(
        "dashboard-panel",
        /** 홈 2열: 형제 액추 패널과 동일 행 높이를 채우고 내부 스크롤은 카드에 위임 */
        compactHomeLayout && "h-full min-h-0",
      )}
    >
      {compactHomeLayout ? (
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0">
          <h2 className="flex shrink-0 items-center gap-1.5 text-sm font-semibold tracking-tight">
            <Thermometer className="size-4 shrink-0 text-primary" aria-hidden />
            Sensor
          </h2>
          <p className="text-muted-foreground min-w-0 flex-1 text-[10px] leading-tight">
            최근 1시간만 · 약 {LIVE_POLL_MS / 1000}초 갱신
          </p>
        </div>
      ) : (
        <>
          <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <Thermometer className="size-5 shrink-0 text-primary" aria-hidden />
            Sensor
          </h2>
          <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
            차트·요약은 최근 1시간 구간만 표시합니다. (약 {LIVE_POLL_MS / 1000}초마다
            갱신)
          </p>
        </>
      )}

      {!hideMqttSettings ? (
        <div className={compactHomeLayout ? "mt-2" : "mt-3"}>
          <MqttBrowserSettings />
        </div>
      ) : null}

      <SensorDashboardFilterBlock
        hideClearReadings={hideClearReadings}
        clearingReadings={clearingReadings}
        onClearReadingsClick={onClearReadingsClick}
        refetchData={refetchData}
        notice={notice}
        selectedTypes={selectedTypes}
        toggleType={toggleType}
        compact={compactHomeLayout}
      />

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

      {!loading && !error && rowsInLiveWindow.length === 0 ? (
        <div
          className="mt-4 flex min-h-[120px] flex-col items-center justify-center rounded-xl border border-dashed border-primary/25 bg-muted/25 px-4 py-8 text-center text-sm text-muted-foreground"
          role="status"
        >
          최근 1시간·선택 타입에 맞는 데이터가 없습니다.
        </div>
      ) : null}

      {!loading && !error && rowsInLiveWindow.length > 0 ? (
        <SensorLiveChartsBlock
          latest={latest}
          typesList={typesList}
          chartData={deferredChartData}
          unitByType={unitByType}
          compact={compactHomeLayout}
        />
      ) : null}
    </section>
  );
}
