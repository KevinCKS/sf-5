"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
  memo,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  ArrowDownWideNarrow,
  CalendarRange,
  Filter,
  Loader2,
  Radio,
  RefreshCw,
  Table2,
  Trash2,
} from "lucide-react";
import { SensorTypeCheckbox } from "@/components/dashboard/SensorTypeCheckbox";
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
  SENSOR_DASHBOARD_LIVE_LIMIT,
  SENSOR_SORT_OPTIONS,
  SENSOR_TYPE_FILTERS,
  type SensorSortId,
} from "@/lib/sensors/constants";
import { formatShortDateTime } from "@/lib/datetime/koShortDateTime";
import {
  sameSensorReadingRows,
  type SensorReadingRow,
} from "@/lib/sensors/queryReadings";
import { dashboardFetchInit } from "@/lib/http/dashboardFetchInit";
import { parseResponseBodyJson } from "@/lib/http/parseResponseBodyJson";
import { requestClearAllSensorReadings } from "@/lib/http/sensorReadingsClient";

/** 10분 단위 분 */
const MINUTES_10 = [0, 10, 20, 30, 40, 50] as const;
/** 시 선택 — 매번 Array.from 생성 없이 고정 배열 */
const HOURS_0_23 = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
] as const;

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 7);
  return { from: sliceLocalDateTime(from), to: sliceLocalDateTime(to) };
}

function sliceLocalDateTime(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const x = new Date(d);
  const m = Math.floor(x.getMinutes() / 10) * 10;
  x.setMinutes(m, 0, 0);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

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
  const date = m[1]!;
  const hour = Math.min(23, Math.max(0, parseInt(m[2]!, 10)));
  const rawMin = parseInt(m[3]!, 10);
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

const dateInputClass =
  "border-input bg-background ring-offset-background focus-visible:ring-ring h-9 min-w-[142px] rounded-md border px-3 py-1 text-sm shadow-sm focus-visible:ring-2 focus-visible:outline-none";

/** 시작·종료 일시만 연속 변경될 때 조회 요청 묶기(ms) — 정렬·타입은 즉시 조회 */
const FROM_TO_DEBOUNCE_MS = 400;

type PreparedTableRow = {
  id: string;
  sensor_name: string;
  sensor_type: string;
  value: number;
  unit: string | null;
  recordedLabel: string;
};

/** 동일 표시값이면 참조 달라도 리렌더 생략 — tableRows 재생성 시 불필요 DOM 갱신 감소 */
function samePreparedTableRow(a: PreparedTableRow, b: PreparedTableRow): boolean {
  return (
    a.id === b.id &&
    a.sensor_name === b.sensor_name &&
    a.sensor_type === b.sensor_type &&
    a.value === b.value &&
    a.unit === b.unit &&
    a.recordedLabel === b.recordedLabel
  );
}

/** 표 한 행 — notice 등으로 부모만 리렌더될 때 동일 행 객체는 스킵 */
const SensorReadingTableRow = memo(
  function SensorReadingTableRow({
    row,
  }: {
    row: PreparedTableRow;
  }) {
    return (
      <tr className="border-t text-xs">
        <td className="text-muted-foreground px-3 py-1.5 font-mono tabular-nums">
          {row.recordedLabel}
        </td>
        <td className="px-3 py-1.5">{row.sensor_name}</td>
        <td className="px-3 py-1.5">{row.sensor_type}</td>
        <td className="px-3 py-1.5 text-right tabular-nums">{row.value}</td>
        <td className="text-muted-foreground px-3 py-1.5">{row.unit ?? "—"}</td>
      </tr>
    );
  },
  (prev, next) => samePreparedTableRow(prev.row, next.row),
);

type SensorReadingsDbFilterBlockProps = {
  from: string;
  to: string;
  fromParts: ReturnType<typeof parseLocalDateTimeParts>;
  toParts: ReturnType<typeof parseLocalDateTimeParts>;
  setFrom: Dispatch<SetStateAction<string>>;
  setTo: Dispatch<SetStateAction<string>>;
  selectedTypes: Set<string>;
  sort: SensorSortId;
  setSort: Dispatch<SetStateAction<SensorSortId>>;
  loading: boolean;
  clearingReadings: boolean;
  notice: string | null;
  toggleType: (type: string) => void;
  refetchFiltered: () => void;
  refetchLive: () => void;
  onClearReadingsClick: () => void;
};

/** 기간·타입·정렬·조회 버튼 — 표 데이터(rows)만 바뀔 때 Select·입력 재렌더 생략 */
const SensorReadingsDbFilterBlock = memo(function SensorReadingsDbFilterBlock({
  from,
  to,
  fromParts,
  toParts,
  setFrom,
  setTo,
  selectedTypes,
  sort,
  setSort,
  loading,
  clearingReadings,
  notice,
  toggleType,
  refetchFiltered,
  refetchLive,
  onClearReadingsClick,
}: SensorReadingsDbFilterBlockProps) {
  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="inline-flex items-center gap-1.5">
            <CalendarRange className="size-3.5 text-muted-foreground" aria-hidden />
            시작 (일시)
          </Label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={fromParts.date}
              onChange={(e) => {
                const p = parseLocalDateTimeParts(from);
                setFrom(
                  composeLocalDateTimeString(e.target.value, p.hour, p.minute),
                );
              }}
              className={dateInputClass}
            />
            <Select
              value={String(fromParts.hour)}
              onValueChange={(v) => {
                if (v == null) return;
                const p = parseLocalDateTimeParts(from);
                setFrom(
                  composeLocalDateTimeString(p.date, parseInt(v, 10), p.minute),
                );
              }}
            >
              <SelectTrigger className="h-9 w-[92px]">
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
                if (v == null) return;
                const p = parseLocalDateTimeParts(from);
                setFrom(
                  composeLocalDateTimeString(p.date, p.hour, parseInt(v, 10)),
                );
              }}
            >
              <SelectTrigger className="h-9 w-[92px]">
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
          <Label className="inline-flex items-center gap-1.5">
            <CalendarRange className="size-3.5 text-muted-foreground" aria-hidden />
            종료 (일시)
          </Label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={toParts.date}
              onChange={(e) => {
                const p = parseLocalDateTimeParts(to);
                setTo(
                  composeLocalDateTimeString(e.target.value, p.hour, p.minute),
                );
              }}
              className={dateInputClass}
            />
            <Select
              value={String(toParts.hour)}
              onValueChange={(v) => {
                if (v == null) return;
                const p = parseLocalDateTimeParts(to);
                setTo(
                  composeLocalDateTimeString(p.date, parseInt(v, 10), p.minute),
                );
              }}
            >
              <SelectTrigger className="h-9 w-[92px]">
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
                if (v == null) return;
                const p = parseLocalDateTimeParts(to);
                setTo(
                  composeLocalDateTimeString(p.date, p.hour, parseInt(v, 10)),
                );
              }}
            >
              <SelectTrigger className="h-9 w-[92px]">
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
        <Label className="inline-flex items-center gap-1.5">
          <Filter className="size-3.5 text-muted-foreground" aria-hidden />
          센서 타입
        </Label>
        <div className="flex flex-wrap gap-3">
          {SENSOR_TYPE_FILTERS.map(({ type, label }) => (
            <SensorTypeCheckbox
              key={type}
              type={type}
              label={label}
              checked={selectedTypes.has(type)}
              onToggle={toggleType}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label
            htmlFor="sensor-db-sort"
            className="inline-flex items-center gap-1.5"
          >
            <ArrowDownWideNarrow className="size-3.5 text-muted-foreground" aria-hidden />
            정렬
          </Label>
          <Select
            value={sort}
            onValueChange={(v) => v && setSort(v as SensorSortId)}
          >
            <SelectTrigger id="sensor-db-sort" className="h-9 w-[min(100%,220px)]">
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
        <div className="flex flex-wrap gap-2">
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
          <Button
            type="button"
            variant="default"
            disabled={loading}
            onClick={refetchLive}
          >
            <Radio className="mr-1.5 size-4 shrink-0" aria-hidden />
            실시간 조회
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={refetchFiltered}
          >
            <RefreshCw className="mr-1.5 size-4 shrink-0" aria-hidden />
            다시 조회
          </Button>
        </div>
      </div>
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

/** DB 탭 — sensor_readings 테이블 형태 조회·필터·전체 삭제 */
export function SensorReadingsDbPanel() {
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
  const [notice, setNotice] = useState<string | null>(null);
  const [clearingReadings, setClearingReadings] = useState(false);

  /** 기간·타입·정렬 변경이 빠를 때 이전 요청 취소·stale 응답 무시 */
  const fetchSeqRef = useRef(0);
  const fetchAbortRef = useRef<AbortController | null>(null);

  /** fetchData 콜백 안정화 — 쿼리 파라미터는 호출 시점의 ref 로 읽음 */
  const queryRef = useRef({ from, to, selectedTypes, sort });
  queryRef.current = { from, to, selectedTypes, sort };

  useEffect(() => {
    return () => {
      fetchAbortRef.current?.abort();
    };
  }, []);

  const fetchData = useCallback(async (opts?: {
    silent?: boolean;
    /** true: 화면의 기간·타입·정렬 필터 무시, 최근 N건·전체 타입 */
    live?: boolean;
  }) => {
    const silent = opts?.silent === true;
    const live = opts?.live === true;
    const { from, to, selectedTypes, sort } = queryRef.current;
    if (!live && selectedTypes.size === 0) {
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
      setError(null);
      setNotice(null);
    }
    const params = new URLSearchParams();
    if (live) {
      params.set("limit", String(SENSOR_DASHBOARD_LIVE_LIMIT));
      params.set("sort", "recorded_at_desc");
      // types 생략 → API 가 본인 소유 전체 타입
    } else {
      params.set("from", new Date(from).toISOString());
      params.set("to", new Date(to).toISOString());
      params.set("sort", sort);
      if (selectedTypes.size < SENSOR_TYPE_FILTERS.length) {
        params.set("types", [...selectedTypes].join(","));
      }
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
      const applyRows = () => {
        setRows((prev) =>
          sameSensorReadingRows(prev, nextRows) ? prev : nextRows,
        );
        setError(null);
        if (live) {
          setNotice(
            `최근 ${SENSOR_DASHBOARD_LIVE_LIMIT}개·전체 센서 타입으로 조회했습니다. (위 필터는 그대로이며 적용되지 않았습니다)`,
          );
        }
      };
      if (silent) {
        startTransition(applyRows);
      } else {
        applyRows();
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

  const prevFromToRef = useRef<{ from: string; to: string } | null>(null);

  useEffect(() => {
    const prev = prevFromToRef.current;
    const fromToChanged =
      prev !== null && (prev.from !== from || prev.to !== to);
    prevFromToRef.current = { from, to };

    if (prev === null) {
      void fetchData();
      return;
    }
    if (!fromToChanged) {
      void fetchData();
      return;
    }
    const id = window.setTimeout(() => {
      void fetchData();
    }, FROM_TO_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [from, to, selectedTypes, sort, fetchData]);

  const fromParts = useMemo(() => parseLocalDateTimeParts(from), [from]);
  const toParts = useMemo(() => parseLocalDateTimeParts(to), [to]);

  /** 표 시각 열 — 동일 recorded_at 은 Intl 1회만, 행은 memo 로 부모 알림 시 재렌더 최소화 */
  const tableRows = useMemo(() => {
    const labelByRecorded = new Map<string, string>();
    return rows.map((r) => {
      let recordedLabel = labelByRecorded.get(r.recorded_at);
      if (recordedLabel === undefined) {
        recordedLabel = formatShortDateTime(r.recorded_at);
        labelByRecorded.set(r.recorded_at, recordedLabel);
      }
      return {
        id: r.id,
        sensor_name: r.sensor_name,
        sensor_type: r.sensor_type,
        value: r.value,
        unit: r.unit,
        recordedLabel,
      };
    });
  }, [rows]);

  const toggleType = useCallback((type: string) => {
    // 표·재조회 트리거를 전환으로 묶어 UI 입력 지연 완화
    startTransition(() => {
      setSelectedTypes((prev) => {
        const next = new Set(prev);
        if (next.has(type)) next.delete(type);
        else next.add(type);
        return next;
      });
    });
  }, []);

  const refetchFiltered = useCallback(() => {
    void fetchData({ silent: false });
  }, [fetchData]);

  const refetchLive = useCallback(() => {
    void fetchData({ silent: false, live: true });
  }, [fetchData]);

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
    <section className="dashboard-panel">
      <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
        <Table2 className="size-5 shrink-0 text-primary" aria-hidden />
        Sensor — DB 조회
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
        시작·종료 일시와 센서 타입으로 필터한 뒤 「다시 조회」로 표를 갱신합니다. 「실시간 조회」는 필터와
        관계없이 최근 {SENSOR_DASHBOARD_LIVE_LIMIT}개·전체 타입만 조회합니다. 차트는 대시보드 탭입니다.
      </p>

      <SensorReadingsDbFilterBlock
        from={from}
        to={to}
        fromParts={fromParts}
        toParts={toParts}
        setFrom={setFrom}
        setTo={setTo}
        selectedTypes={selectedTypes}
        sort={sort}
        setSort={setSort}
        loading={loading}
        clearingReadings={clearingReadings}
        notice={notice}
        toggleType={toggleType}
        refetchFiltered={refetchFiltered}
        refetchLive={refetchLive}
        onClearReadingsClick={onClearReadingsClick}
      />

      {loading ? (
        <div className="text-muted-foreground mt-4 flex items-center gap-2 text-sm" role="status">
          <Loader2 className="h-4 w-4 animate-spin" />
          불러오는 중…
        </div>
      ) : null}

      {!loading && error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <p className="text-muted-foreground mt-4 text-sm">조건에 맞는 행이 없습니다.</p>
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <div className="mt-4 max-h-[min(70vh,720px)] overflow-auto rounded-md border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-muted/50 text-xs font-medium">
              <tr>
                <th className="px-3 py-2">수집 시각</th>
                <th className="px-3 py-2">센서명</th>
                <th className="px-3 py-2">타입</th>
                <th className="px-3 py-2 text-right">값</th>
                <th className="px-3 py-2">단위</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r) => (
                <SensorReadingTableRow key={r.id} row={r} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
