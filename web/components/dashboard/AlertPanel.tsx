"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseResponseBodyJson } from "@/lib/http/parseResponseBodyJson";
import { SENSOR_TYPE_FILTERS } from "@/lib/sensors/constants";

/** 센서 타입 → 짧은 한글 라벨 */
function typeLabel(t: string): string {
  return SENSOR_TYPE_FILTERS.find((x) => x.type === t)?.label ?? t;
}

type SensorRow = {
  id: string;
  name: string;
  sensor_type: string;
  unit: string | null;
  zone_name: string | null;
};

type SettingApi = {
  sensor_id: string;
  min_value: number | null;
  max_value: number | null;
  enabled: boolean;
};

type Draft = { min: string; max: string; enabled: boolean };

type LogRow = {
  id: string;
  message: string;
  created_at: string;
};

/** Alert 탭 — 임계치 설정·이력·시뮬레이션 (PRD §5.5–5.6) */
export function AlertPanel() {
  const [sensors, setSensors] = useState<SensorRow[]>([]);
  const [settings, setSettings] = useState<SettingApi[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [simSensorId, setSimSensorId] = useState<string>("");
  const [simValue, setSimValue] = useState<string>("");
  const [simBusy, setSimBusy] = useState(false);

  const settingsBySensor = useMemo(() => {
    const m = new Map<string, SettingApi>();
    for (const s of settings) {
      m.set(s.sensor_id, s);
    }
    return m;
  }, [settings]);

  /** silent: 저장 후·새로고침 시 전체 화면 스피너 없이 데이터만 갱신 */
  const loadAll = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    setError(null);
    if (!silent) {
      setLoading(true);
    }
    setLogsLoading(true);
    try {
      const [resS, resSt, resL] = await Promise.all([
        fetch("/api/sensors", { credentials: "include" }),
        fetch("/api/alert-settings", { credentials: "include" }),
        fetch("/api/alert-logs?limit=50", { credentials: "include" }),
      ]);

      const pS = await parseResponseBodyJson<{ sensors?: SensorRow[]; error?: string }>(
        resS,
      );
      const pSt = await parseResponseBodyJson<{
        settings?: SettingApi[];
        error?: string;
      }>(resSt);
      const pL = await parseResponseBodyJson<{ logs?: LogRow[]; error?: string }>(resL);

      if (!pS.parseOk) {
        setError(pS.fallbackMessage);
        return;
      }
      if (!resS.ok) {
        setError(pS.data.error ?? "센서 목록을 불러오지 못했습니다.");
        return;
      }
      if (!pSt.parseOk) {
        setError(pSt.fallbackMessage);
        return;
      }
      if (!resSt.ok) {
        setError(pSt.data.error ?? "설정을 불러오지 못했습니다.");
        return;
      }
      if (!pL.parseOk) {
        setError(pL.fallbackMessage);
        return;
      }
      if (!resL.ok) {
        setError(pL.data.error ?? "이력을 불러오지 못했습니다.");
        return;
      }

      const sensorList = pS.data.sensors ?? [];
      const stList = pSt.data.settings ?? [];
      setSensors(sensorList);
      setSettings(
        stList.map((r) => ({
          sensor_id: r.sensor_id,
          min_value: r.min_value,
          max_value: r.max_value,
          enabled: r.enabled ?? true,
        })),
      );

      const nextDrafts: Record<string, Draft> = {};
      for (const s of sensorList) {
        const st = stList.find((x) => x.sensor_id === s.id);
        nextDrafts[s.id] = {
          min: st?.min_value != null ? String(st.min_value) : "",
          max: st?.max_value != null ? String(st.max_value) : "",
          enabled: st?.enabled ?? true,
        };
      }
      setDrafts(nextDrafts);
      setLogs(pL.data.logs ?? []);
      setSimSensorId((prev) => prev || sensorList[0]?.id || "");
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      if (!silent) {
        setLoading(false);
      }
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function saveRow(sensorId: string) {
    const d = drafts[sensorId];
    if (!d) return;
    setSavingId(sensorId);
    setError(null);
    try {
      const res = await fetch("/api/alert-settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sensor_id: sensorId,
          min_value: d.min.trim() === "" ? null : Number(d.min),
          max_value: d.max.trim() === "" ? null : Number(d.max),
          enabled: d.enabled,
        }),
      });
      const parsed = await parseResponseBodyJson<{
        ok?: boolean;
        error?: string;
        setting?: {
          sensor_id: string;
          min_value: number | null;
          max_value: number | null;
          enabled: boolean;
        };
      }>(res);
      if (!parsed.parseOk) {
        setError(parsed.fallbackMessage);
        return;
      }
      if (!res.ok) {
        setError(parsed.data.error ?? "저장에 실패했습니다.");
        return;
      }
      const st = parsed.data.setting;
      if (st) {
        setSettings((prev) => {
          const rest = prev.filter((x) => x.sensor_id !== st.sensor_id);
          return [
            ...rest,
            {
              sensor_id: st.sensor_id,
              min_value: st.min_value,
              max_value: st.max_value,
              enabled: st.enabled ?? true,
            },
          ];
        });
        setDrafts((prev) => ({
          ...prev,
          [st.sensor_id]: {
            min: st.min_value != null ? String(st.min_value) : "",
            max: st.max_value != null ? String(st.max_value) : "",
            enabled: st.enabled ?? true,
          },
        }));
      }
      setNotice("저장했습니다.");
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSavingId(null);
    }
  }

  async function runSimulate() {
    if (!simSensorId) {
      setError("센서를 선택해 주세요.");
      return;
    }
    const v = Number(simValue);
    if (!Number.isFinite(v)) {
      setError("시뮬레이션 값은 숫자여야 합니다.");
      return;
    }
    setSimBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/alerts/simulate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sensor_id: simSensorId, value: v }),
      });
      const parsed = await parseResponseBodyJson<{
        ok?: boolean;
        alertsLogged?: number;
        error?: string;
      }>(res);
      if (!parsed.parseOk) {
        setError(parsed.fallbackMessage);
        return;
      }
      if (!res.ok) {
        setError(parsed.data.error ?? "시뮬레이션에 실패했습니다.");
        return;
      }
      const n = parsed.data.alertsLogged ?? 0;
      setNotice(
        n > 0
          ? `임계치 초과로 알림 ${n}건을 기록했습니다.`
          : "임계치를 벗어나지 않았거나 비활성 설정입니다. 알림 로그가 추가되지 않았습니다.",
      );
      const resL = await fetch("/api/alert-logs?limit=50", { credentials: "include" });
      const pL = await parseResponseBodyJson<{ logs?: LogRow[] }>(resL);
      if (pL.parseOk && resL.ok && pL.data.logs) {
        setLogs(pL.data.logs);
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSimBusy(false);
    }
  }

  function updateDraft(sensorId: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({
      ...prev,
      [sensorId]: { ...prev[sensorId]!, ...patch },
    }));
  }

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        불러오는 중…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="dashboard-panel">
        <h2 className="text-base font-semibold tracking-tight">임계치 설정</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          센서별 하한·상한을 지정하면, MQTT 또는 아래 시뮬로 값이 저장될 때 초과 여부를 검사해
          알림 이력에 남깁니다.
        </p>

        {/* 높이 고정: 저장 시 문구 유무로 카드·표 위치가 들쭉날쭉하지 않게 함 */}
        <div
          className="mt-3 flex min-h-[2.75rem] flex-col justify-center text-sm leading-snug"
          aria-live="polite"
        >
          {error ? (
            <p className="text-destructive line-clamp-3" role="alert" title={error}>
              {error}
            </p>
          ) : notice ? (
            <p
              className="text-emerald-700 line-clamp-3 dark:text-emerald-400"
              role="status"
              title={notice}
            >
              {notice}
            </p>
          ) : (
            <span className="text-transparent select-none" aria-hidden="true">
              .
            </span>
          )}
        </div>

        {sensors.length === 0 ? (
          <p className="text-muted-foreground mt-4 text-sm">
            등록된 센서가 없습니다. 먼저 Supabase에 센서 메타를 넣어 주세요.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">센서</th>
                  <th className="pb-2 pr-3 font-medium">타입</th>
                  <th className="pb-2 pr-3 font-medium">하한</th>
                  <th className="pb-2 pr-3 font-medium">상한</th>
                  <th className="pb-2 pr-3 font-medium">활성</th>
                  <th className="pb-2 font-medium">저장</th>
                </tr>
              </thead>
              <tbody>
                {sensors.map((s) => {
                  const d = drafts[s.id];
                  const hasSetting = settingsBySensor.has(s.id);
                  if (!d) return null;
                  return (
                    <tr key={s.id} className="border-b border-border/60 [&>td]:py-2 [&>td]:align-middle">
                      <td className="pr-3 font-medium">{s.name}</td>
                      <td className="text-muted-foreground pr-3">
                        {typeLabel(s.sensor_type)}
                        {s.unit ? ` (${s.unit})` : ""}
                      </td>
                      <td className="pr-3">
                        <Input
                          className="h-8 w-24"
                          inputMode="decimal"
                          value={d.min}
                          onChange={(e) => updateDraft(s.id, { min: e.target.value })}
                          aria-label={`${s.name} 하한`}
                        />
                      </td>
                      <td className="pr-3">
                        <Input
                          className="h-8 w-24"
                          inputMode="decimal"
                          value={d.max}
                          onChange={(e) => updateDraft(s.id, { max: e.target.value })}
                          aria-label={`${s.name} 상한`}
                        />
                      </td>
                      <td className="pr-3">
                        <label className="flex h-8 cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={d.enabled}
                            onChange={(e) =>
                              updateDraft(s.id, { enabled: e.target.checked })
                            }
                            className="accent-primary h-4 w-4 rounded border"
                          />
                          <span className="sr-only">활성</span>
                        </label>
                      </td>
                      <td className="w-[5.5rem]">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={savingId === s.id}
                          className="h-8 w-[5.25rem] shrink-0 px-0"
                          onClick={() => void saveRow(s.id)}
                        >
                          {savingId === s.id ? (
                            <Loader2
                              className="mx-auto h-4 w-4 animate-spin"
                              aria-label="저장 중"
                            />
                          ) : hasSetting ? (
                            "저장"
                          ) : (
                            "등록"
                          )}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="dashboard-panel">
        <h2 className="text-base font-semibold tracking-tight">임계치 시뮬레이션</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          선택한 센서에 측정값 1건을 넣고 즉시 임계치를 검사합니다(MQTT 없이 검증 가능).
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>센서</Label>
            <Select
              value={simSensorId}
              onValueChange={(v) => {
                if (v != null) setSimSensorId(v);
              }}
              disabled={sensors.length === 0 || simBusy}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="선택" />
              </SelectTrigger>
              <SelectContent>
                {sensors.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({typeLabel(s.sensor_type)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>측정값</Label>
            <Input
              className="h-9 w-32"
              inputMode="decimal"
              value={simValue}
              onChange={(e) => setSimValue(e.target.value)}
              placeholder="예: 35"
              disabled={simBusy}
            />
          </div>
          <Button
            type="button"
            onClick={() => void runSimulate()}
            disabled={simBusy || sensors.length === 0}
          >
            {simBusy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                실행 중
              </>
            ) : (
              "검사 실행"
            )}
          </Button>
        </div>
      </section>

      <section className="dashboard-panel">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold tracking-tight">알림 이력</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadAll({ silent: true })}
            disabled={logsLoading}
          >
            새로고침
          </Button>
        </div>
        {logsLoading ? (
          <p className="text-muted-foreground mt-4 text-sm">불러오는 중…</p>
        ) : logs.length === 0 ? (
          <p className="text-muted-foreground mt-4 text-sm">
            기록된 알림이 없습니다. 임계치를 저장한 뒤 시뮬레이션이나 MQTT 수신을 시도해 보세요.
          </p>
        ) : (
          <ul className="mt-4 space-y-2 text-sm">
            {logs.map((log) => (
              <li
                key={log.id}
                className="border-b border-border/40 pb-2 last:border-0"
              >
                <span className="text-muted-foreground text-xs">
                  {new Date(log.created_at).toLocaleString("ko-KR")}
                </span>
                <p className="mt-0.5">{log.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
