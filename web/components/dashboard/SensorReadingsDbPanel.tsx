"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import type { SensorReadingRow } from "@/lib/sensors/queryReadings";
import { parseResponseBodyJson } from "@/lib/http/parseResponseBodyJson";

/** 10분 단위 분 */
const MINUTES_10 = [0, 10, 20, 30, 40, 50] as const;
const HOURS_0_23 = Array.from({ length: 24 }, (_, i) => i);

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
      setError(null);
      setNotice(null);
    }
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
  }, [from, to, selectedTypes, sort]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const fromParts = useMemo(() => parseLocalDateTimeParts(from), [from]);
  const toParts = useMemo(() => parseLocalDateTimeParts(to), [to]);

  function toggleType(type: string) {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

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
      <h2 className="text-base font-semibold tracking-tight">Sensor — DB 조회</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        시작·종료 일시와 센서 타입으로 필터한 뒤 표로 조회합니다. 차트·실시간은 대시보드 탭입니다.
      </p>

      <div className="mt-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>시작 (일시)</Label>
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
            <Label>종료 (일시)</Label>
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
          <Label>센서 타입</Label>
          <div className="flex flex-wrap gap-3">
            {SENSOR_TYPE_FILTERS.map(({ type, label }) => (
              <label key={type} className="flex cursor-pointer items-center gap-2 text-sm">
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

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="sensor-db-sort">정렬</Label>
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
              onClick={() => void handleClearAllReadings()}
            >
              {clearingReadings ? "삭제 중…" : "측정 이력 전체 삭제"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void fetchData({ silent: false })}
            >
              다시 조회
            </Button>
          </div>
        </div>
        {notice ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">
            {notice}
          </p>
        ) : null}
      </div>

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
        <div className="mt-4 overflow-x-auto rounded-md border">
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
              {rows.map((r) => (
                <tr key={r.id} className="border-t text-xs">
                  <td className="text-muted-foreground px-3 py-1.5 font-mono tabular-nums">
                    {new Date(r.recorded_at).toLocaleString("ko-KR")}
                  </td>
                  <td className="px-3 py-1.5">{r.sensor_name}</td>
                  <td className="px-3 py-1.5">{r.sensor_type}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{r.value}</td>
                  <td className="text-muted-foreground px-3 py-1.5">{r.unit ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
