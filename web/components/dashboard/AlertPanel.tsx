"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
  memo,
} from "react";
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
import { KO_SHORT_DATETIME } from "@/lib/datetime/koShortDateTime";
import {
  dashboardFetchInit,
  dashboardJsonFetchInit,
  mqttBackgroundFetchInit,
} from "@/lib/http/dashboardFetchInit";
import { parseResponseBodyJson } from "@/lib/http/parseResponseBodyJson";
import { sensorTypeLabel } from "@/lib/sensors/constants";

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

/** 동일 알림 이력이면 참조 유지 — silent 새로고침 시 logRowsPrepared·목록 재계산 생략 */
function sameLogRows(a: LogRow[], b: LogRow[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (
      x.id !== y.id ||
      x.message !== y.message ||
      x.created_at !== y.created_at
    ) {
      return false;
    }
  }
  return true;
}

/** API 센서 목록 순서 동일·행 동일 시 참조 유지 */
function sameSensorRowsAlert(a: SensorRow[], b: SensorRow[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (
      x.id !== y.id ||
      x.name !== y.name ||
      x.sensor_type !== y.sensor_type ||
      x.unit !== y.unit ||
      x.zone_name !== y.zone_name
    ) {
      return false;
    }
  }
  return true;
}

/** 임계치 설정 — sensor_id 기준 매칭(응답 순서 달라도 동일하면 참조 유지) */
function sameSettingsApi(a: SettingApi[], b: SettingApi[]): boolean {
  if (a.length !== b.length) return false;
  const mapB = new Map(b.map((x) => [x.sensor_id, x] as const));
  for (const x of a) {
    const y = mapB.get(x.sensor_id);
    if (
      !y ||
      x.min_value !== y.min_value ||
      x.max_value !== y.max_value ||
      x.enabled !== y.enabled
    ) {
      return false;
    }
  }
  return true;
}

/** 초안 입력값 동일 시 참조 유지 */
function sameDraftsRecord(
  a: Record<string, Draft>,
  b: Record<string, Draft>,
): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysB) {
    const da = a[k];
    const db = b[k];
    if (
      !da ||
      !db ||
      da.min !== db.min ||
      da.max !== db.max ||
      da.enabled !== db.enabled
    ) {
      return false;
    }
  }
  return true;
}

/** 알림 로그 한 줄 — 상단 입력 상태만 바뀔 때 목록 DOM 재생성 완화 */
const AlertLogListItem = memo(function AlertLogListItem({
  createdLabel,
  message,
}: {
  createdLabel: string;
  message: string;
}) {
  return (
    <li className="[contain-intrinsic-size:auto_4rem] [content-visibility:auto] border-b border-border/40 pb-2 last:border-0">
      <span className="text-muted-foreground text-xs">{createdLabel}</span>
      <p className="mt-0.5">{message}</p>
    </li>
  );
});

type AlertSensorSettingsRowProps = {
  sensor: SensorRow;
  draft: Draft;
  hasSetting: boolean;
  isSaving: boolean;
  updateDraft: (sensorId: string, patch: Partial<Draft>) => void;
  onSave: (sensorId: string) => void | Promise<void>;
};

/** 임계치 표 한 행 — 다른 센서 행 입력·저장 시 참조 동일하면 리렌더 생략 */
const AlertSensorSettingsRow = memo(function AlertSensorSettingsRow({
  sensor,
  draft,
  hasSetting,
  isSaving,
  updateDraft,
  onSave,
}: AlertSensorSettingsRowProps) {
  return (
    <tr className="border-b border-border/60 [&>td]:py-2 [&>td]:align-middle">
      <td className="pr-3 font-medium">{sensor.name}</td>
      <td className="text-muted-foreground pr-3">
        {sensorTypeLabel(sensor.sensor_type)}
        {sensor.unit ? ` (${sensor.unit})` : ""}
      </td>
      <td className="pr-3">
        <Input
          className="h-8 w-24"
          inputMode="decimal"
          value={draft.min}
          onChange={(e) => updateDraft(sensor.id, { min: e.target.value })}
          aria-label={`${sensor.name} 하한`}
        />
      </td>
      <td className="pr-3">
        <Input
          className="h-8 w-24"
          inputMode="decimal"
          value={draft.max}
          onChange={(e) => updateDraft(sensor.id, { max: e.target.value })}
          aria-label={`${sensor.name} 상한`}
        />
      </td>
      <td className="pr-3">
        <label className="flex h-8 cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) =>
              updateDraft(sensor.id, { enabled: e.target.checked })
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
          disabled={isSaving}
          className="h-8 w-[5.25rem] shrink-0 px-0"
          onClick={() => void onSave(sensor.id)}
        >
          {isSaving ? (
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
});

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

  /** saveRow 가 최신 drafts 를 읽도록 — useCallback 의존성에 drafts 전체를 넣지 않음 */
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;

  const settingsBySensor = useMemo(() => {
    const m = new Map<string, SettingApi>();
    for (const s of settings) {
      m.set(s.sensor_id, s);
    }
    return m;
  }, [settings]);

  /** 알림 시각 문자열 — 동일 created_at 은 Intl 1회만 */
  const logRowsPrepared = useMemo(() => {
    const labelByCreated = new Map<string, string>();
    return logs.map((log) => {
      let createdLabel = labelByCreated.get(log.created_at);
      if (createdLabel === undefined) {
        createdLabel = KO_SHORT_DATETIME.format(new Date(log.created_at));
        labelByCreated.set(log.created_at, createdLabel);
      }
      return {
        id: log.id,
        message: log.message,
        createdLabel,
      };
    });
  }, [logs]);

  /** 연속 loadAll 시 이전 병렬 요청 취소·stale 응답 무시 */
  const loadAllSeqRef = useRef(0);
  const loadAllAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      loadAllAbortRef.current?.abort();
    };
  }, []);

  /** silent: 저장 후·새로고침 시 전체 화면 스피너 없이 데이터만 갱신 */
  const loadAll = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    const seq = ++loadAllSeqRef.current;
    loadAllAbortRef.current?.abort();
    const ac = new AbortController();
    loadAllAbortRef.current = ac;
    const { signal } = ac;

    setError(null);
    if (!silent) {
      setLoading(true);
    }
    setLogsLoading(true);
    try {
      const init = dashboardFetchInit(signal, { silent });
      const [resS, resSt, resL] = await Promise.all([
        fetch("/api/sensors", init),
        fetch("/api/alert-settings", init),
        fetch("/api/alert-logs?limit=50", init),
      ]);

      if (seq !== loadAllSeqRef.current) return;

      // 본문 파싱을 병렬로 — 세 응답의 JSON 파싱이 순차 대기하지 않음
      const [pS, pSt, pL] = await Promise.all([
        parseResponseBodyJson<{ sensors?: SensorRow[]; error?: string }>(resS),
        parseResponseBodyJson<{
          settings?: SettingApi[];
          error?: string;
        }>(resSt),
        parseResponseBodyJson<{ logs?: LogRow[]; error?: string }>(resL),
      ]);

      if (seq !== loadAllSeqRef.current) return;

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
      const nextSettings = stList.map((r) => ({
        sensor_id: r.sensor_id,
        min_value: r.min_value,
        max_value: r.max_value,
        enabled: r.enabled ?? true,
      }));
      const commitData = () => {
        setSensors((prev) =>
          sameSensorRowsAlert(prev, sensorList) ? prev : sensorList,
        );
        setSettings((prev) =>
          sameSettingsApi(prev, nextSettings) ? prev : nextSettings,
        );

        const stBySensorId = new Map(
          stList.map((x) => [x.sensor_id, x] as const),
        );
        const nextDrafts: Record<string, Draft> = {};
        for (const s of sensorList) {
          const st = stBySensorId.get(s.id);
          nextDrafts[s.id] = {
            min: st?.min_value != null ? String(st.min_value) : "",
            max: st?.max_value != null ? String(st.max_value) : "",
            enabled: st?.enabled ?? true,
          };
        }
        setDrafts((prev) =>
          sameDraftsRecord(prev, nextDrafts) ? prev : nextDrafts,
        );
        const nextLogs = pL.data.logs ?? [];
        setLogs((prev) => (sameLogRows(prev, nextLogs) ? prev : nextLogs));
        setSimSensorId((prev) => prev || sensorList[0]?.id || "");
      };
      if (silent) startTransition(commitData);
      else commitData();
    } catch {
      if (seq !== loadAllSeqRef.current) return;
      if (ac.signal.aborted) return;
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      if (seq !== loadAllSeqRef.current) return;
      if (!silent) {
        setLoading(false);
      }
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  /** 알림 이력 새로고침 — 인라인 람다 대신 안정 참조 */
  const refreshLogs = useCallback(() => {
    void loadAll({ silent: true });
  }, [loadAll]);

  const saveRow = useCallback(async (sensorId: string) => {
    const d = draftsRef.current[sensorId];
    if (!d) return;
    setSavingId(sensorId);
    setError(null);
    try {
      const res = await fetch("/api/alert-settings", {
        method: "PUT",
        ...dashboardJsonFetchInit({
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sensor_id: sensorId,
            min_value: d.min.trim() === "" ? null : Number(d.min),
            max_value: d.max.trim() === "" ? null : Number(d.max),
            enabled: d.enabled,
          }),
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
      // 설정·draft·안내 갱신을 전환으로 묶어 저장 직후 입력·스크롤 반응성 유지
      startTransition(() => {
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
      });
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSavingId(null);
    }
  }, []);

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
        ...dashboardJsonFetchInit({
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sensor_id: simSensorId, value: v }),
        }),
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
      // 로그 조회를 알림 문구 갱신보다 먼저 시작해 네트워크 RTT 를 앞당김
      const logsPromise = fetch(
        "/api/alert-logs?limit=50",
        mqttBackgroundFetchInit(),
      );
      setNotice(
        n > 0
          ? `임계치 초과로 알림 ${n}건을 기록했습니다.`
          : "임계치를 벗어나지 않았거나 비활성 설정입니다. 알림 로그가 추가되지 않았습니다.",
      );
      const resL = await logsPromise;
      const pL = await parseResponseBodyJson<{ logs?: LogRow[] }>(resL);
      if (pL.parseOk && resL.ok && pL.data.logs) {
        const nextLogs = pL.data.logs;
        startTransition(() => {
          setLogs((prev) => (sameLogRows(prev, nextLogs) ? prev : nextLogs));
        });
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSimBusy(false);
    }
  }

  /** 입력 핸들러가 매 렌더마다 새 함수를 받지 않도록 고정 — 자식 리렌더·메모 비용 완화 */
  const updateDraft = useCallback((sensorId: string, patch: Partial<Draft>) => {
    setDrafts((prev) => ({
      ...prev,
      [sensorId]: { ...prev[sensorId]!, ...patch },
    }));
  }, []);

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
                  if (!d) return null;
                  return (
                    <AlertSensorSettingsRow
                      key={s.id}
                      sensor={s}
                      draft={d}
                      hasSetting={settingsBySensor.has(s.id)}
                      isSaving={savingId === s.id}
                      updateDraft={updateDraft}
                      onSave={saveRow}
                    />
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
                    {s.name} ({sensorTypeLabel(s.sensor_type)})
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
            onClick={refreshLogs}
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
          <ul className="mt-4 max-h-[min(50vh,420px)] space-y-2 overflow-y-auto pr-1 text-sm">
            {logRowsPrepared.map((log) => (
              <AlertLogListItem
                key={log.id}
                createdLabel={log.createdLabel}
                message={log.message}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
