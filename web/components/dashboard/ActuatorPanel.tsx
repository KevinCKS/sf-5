"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Gauge, Loader2, RefreshCw, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ACTUATOR_ROWS } from "@/lib/mqtt/actuatorTopics";
import { parseResponseBodyJson } from "@/lib/http/parseResponseBodyJson";

type ActuatorControlRow = {
  id: string;
  actuator_key: string;
  state: string;
  recorded_at: string;
};

type HwRow = { state: string; updated_at: string };

/** 액츄에이터 ON/OFF — POST /api/mqtt/publish + 이력 + §6.3 보드 상태 */
export function ActuatorPanel() {
  const [history, setHistory] = useState<ActuatorControlRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [hwByKey, setHwByKey] = useState<Record<string, HwRow>>({});
  const [hwError, setHwError] = useState<string | null>(null);
  const [loadingHw, setLoadingHw] = useState(true);
  /** 동일 행 연타·중복 요청만 막음(UI 비활성·스피너 없음) */
  const publishInFlightRef = useRef<Set<string>>(new Set());
  /** 서버 발행 성공 직후 표시(보드 §6.3 보고 전까지). 보드 updated_at 이 명령 시각 이후면 DB 값 우선 */
  const [commandEchoByKey, setCommandEchoByKey] = useState<
    Record<string, { state: "ON" | "OFF"; atMs: number }>
  >({});
  const [clearing, setClearing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setListError(null);
    try {
      const res = await fetch("/api/actuator-controls?limit=25", {
        credentials: "include",
      });
      const parsed = await parseResponseBodyJson<{ rows?: ActuatorControlRow[]; error?: string }>(
        res,
      );
      if (!parsed.parseOk) {
        setListError(parsed.fallbackMessage);
        setHistory([]);
        return;
      }
      if (!res.ok) {
        setListError(parsed.data.error ?? "이력을 불러오지 못했습니다.");
        setHistory([]);
        return;
      }
      setHistory(parsed.data.rows ?? []);
    } catch {
      setListError("네트워크 오류가 발생했습니다.");
      setHistory([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  /** PRD §6.3 — actuator_status(보드가 MQTT로 보고한 최신 상태) */
  const loadHardware = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) {
      setHwError(null);
      setLoadingHw(true);
    }
    try {
      const res = await fetch("/api/actuators/status", {
        credentials: "include",
      });
      const parsed = await parseResponseBodyJson<{
        rows?: { actuator_key: string; state: string; updated_at: string }[];
        error?: string;
      }>(res);
      if (!parsed.parseOk) {
        setHwError(parsed.fallbackMessage);
        setHwByKey({});
        return;
      }
      if (!res.ok) {
        setHwError(parsed.data.error ?? "보드 상태를 불러오지 못했습니다.");
        setHwByKey({});
        return;
      }
      const next: Record<string, HwRow> = {};
      for (const r of parsed.data.rows ?? []) {
        next[r.actuator_key] = { state: r.state, updated_at: r.updated_at };
      }
      setHwByKey(next);
    } catch {
      setHwError("네트워크 오류가 발생했습니다.");
      setHwByKey({});
    } finally {
      if (!silent) setLoadingHw(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    void loadHardware();
  }, [loadHardware]);

  useEffect(() => {
    const h = () => void loadHardware({ silent: true });
    window.addEventListener("smartfarm-actuator-status-stored", h);
    return () => window.removeEventListener("smartfarm-actuator-status-stored", h);
  }, [loadHardware]);

  async function publishState(topic: string, state: "ON" | "OFF", rowKey: string) {
    if (publishInFlightRef.current.has(rowKey)) return;
    publishInFlightRef.current.add(rowKey);
    setActionError(null);
    try {
      const res = await fetch("/api/mqtt/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ topic, payload: { state } }),
      });
      const parsed = await parseResponseBodyJson<{
        ok?: boolean;
        error?: string;
        topic?: string;
        mqttOk?: boolean;
      }>(res);
      if (!parsed.parseOk) {
        setActionError(parsed.fallbackMessage);
        return;
      }
      const json = parsed.data;
      if (!res.ok) {
        setActionError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      setCommandEchoByKey((prev) => ({
        ...prev,
        [rowKey]: { state, atMs: Date.now() },
      }));
      void loadHistory();
    } catch {
      setActionError("네트워크 오류가 발생했습니다.");
    } finally {
      publishInFlightRef.current.delete(rowKey);
    }
  }

  /** 본인 actuator_controls 이력 전체 삭제 */
  async function clearHistory() {
    if (
      !window.confirm(
        "actuator_controls 테이블에서 본인 이력을 모두 삭제할까요? 이 작업은 되돌릴 수 없습니다.",
      )
    ) {
      return;
    }
    setActionError(null);
    setClearing(true);
    try {
      const res = await fetch("/api/actuator-controls", {
        method: "DELETE",
        credentials: "include",
      });
      const parsed = await parseResponseBodyJson<{ ok?: boolean; error?: string }>(res);
      if (!parsed.parseOk) {
        setActionError(parsed.fallbackMessage);
        return;
      }
      if (!res.ok) {
        setActionError(parsed.data.error ?? `HTTP ${res.status}`);
        return;
      }
      await loadHistory();
    } catch {
      setActionError("네트워크 오류가 발생했습니다.");
    } finally {
      setClearing(false);
    }
  }

  function labelForKey(key: string) {
    return ACTUATOR_ROWS.find((r) => r.key === key)?.label ?? key;
  }

  /** 보드 DB 값 vs 방금 보낸 명령(서버 발행 성공) 중 화면에 보여줄 값 */
  function resolveActuatorDisplay(rowKey: string): {
    state: string | undefined;
    variant: "board" | "command";
    subLabel: string;
  } {
    const hw = hwByKey[rowKey];
    const echo = commandEchoByKey[rowKey];
    const hwTime = hw?.updated_at ? new Date(hw.updated_at).getTime() : 0;
    if (echo && (!hw?.updated_at || hwTime < echo.atMs)) {
      return {
        state: echo.state,
        variant: "command",
        subLabel: `${new Date(echo.atMs).toLocaleString("ko-KR")} · 보드 보고 대기`,
      };
    }
    return {
      state: hw?.state,
      variant: "board",
      subLabel: hw?.updated_at
        ? new Date(hw.updated_at).toLocaleString("ko-KR")
        : "갱신 시각 —",
    };
  }

  /** ON/OFF 배지 — board: §6.3 DB, command: 서버 발행 직후(보드 미반영) */
  function stateBadge(
    state: string | undefined,
    variant: "board" | "command" = "board",
  ) {
    if (!state) {
      return (
        <span className="text-muted-foreground font-mono text-xs tabular-nums">—</span>
      );
    }
    const on = state === "ON";
    if (variant === "command") {
      return (
        <span
          className={
            on
              ? "inline-flex rounded-md border border-sky-500/50 bg-sky-500/15 px-2 py-0.5 font-mono text-xs font-semibold text-sky-900 dark:text-sky-100"
              : "inline-flex rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-xs font-medium text-amber-900 dark:text-amber-100"
          }
        >
          {state}
        </span>
      );
    }
    return (
      <span
        className={
          on
            ? "inline-flex rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 font-mono text-xs font-semibold text-emerald-800 dark:text-emerald-200"
            : "inline-flex rounded-md border border-muted-foreground/30 bg-muted/50 px-2 py-0.5 font-mono text-xs font-medium text-muted-foreground"
        }
      >
        {state}
      </span>
    );
  }

  return (
    <section className="flex flex-col rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
      <h2 className="text-base font-semibold tracking-tight">Actuator</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        §6.2: 명령 발행 후 이력 저장. 클릭 직후에는 <strong className="text-foreground font-medium">명령</strong> 배지로
        서버 발행 결과를 바로 보여 주고, §6.3 보드 MQTT 보고가 오면 <strong className="text-foreground font-medium">보드</strong> 값으로
        바뀝니다 (Sensor 카드 MQTT 연결).
      </p>
      {hwError ? (
        <p className="text-destructive mt-2 text-xs" role="status">
          {hwError}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-b border-dashed pb-3">
        <h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          원격 제어 · 보드 상태
        </h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loadingHw}
          onClick={() => void loadHardware()}
          className="shrink-0"
        >
          {loadingHw ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-4 w-4" aria-hidden />
          )}
          <span className="ml-1.5">상태 새로고침</span>
        </Button>
      </div>

      <div className="mt-3 space-y-3">
        {ACTUATOR_ROWS.map((row) => {
          const disp = resolveActuatorDisplay(row.key);
          const showHwSpinner =
            loadingHw &&
            !hwByKey[row.key] &&
            !commandEchoByKey[row.key] &&
            !disp.state;
          return (
            <div
              key={row.key}
              className="flex flex-wrap items-stretch justify-between gap-3 rounded-md border bg-muted/20 px-3 py-3"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <div className="text-sm font-medium leading-none">{row.label}</div>
                <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className="inline-flex items-center gap-1"
                    title={
                      disp.variant === "command"
                        ? "서버가 MQTT 발행까지 완료(보드 §6.3 보고 전)"
                        : "actuator_status (§6.3)"
                    }
                  >
                    {disp.variant === "command" ? (
                      <Send className="text-sky-600/90 dark:text-sky-400 h-3.5 w-3.5 shrink-0" aria-hidden />
                    ) : (
                      <Gauge className="text-muted-foreground/80 h-3.5 w-3.5 shrink-0" aria-hidden />
                    )}
                    <span>{disp.variant === "command" ? "명령" : "보드"}</span>
                  </span>
                  {showHwSpinner ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin opacity-70" aria-hidden />
                  ) : (
                    stateBadge(disp.state, disp.variant)
                  )}
                  <span className="text-muted-foreground max-w-[min(100%,14rem)] font-mono text-[11px] leading-snug tabular-nums sm:max-w-none">
                    {disp.subLabel}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 self-center">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="min-w-[4.25rem]"
                  onClick={() => void publishState(row.topic, "ON", row.key)}
                >
                  ON
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-w-[4.25rem]"
                  onClick={() => void publishState(row.topic, "OFF", row.key)}
                >
                  OFF
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {actionError ? (
        <p className="text-destructive mt-3 text-sm" role="alert">
          {actionError}
        </p>
      ) : null}

      <div className="mt-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            최근 이력
          </h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-destructive border-destructive/40 hover:bg-destructive/10"
            disabled={clearing || loadingList || history.length === 0}
            onClick={() => void clearHistory()}
          >
            {clearing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="h-4 w-4" aria-hidden />
            )}
            <span className="ml-1.5">이력 비우기</span>
          </Button>
        </div>
        {loadingList ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            불러오는 중…
          </div>
        ) : listError ? (
          <p className="text-destructive text-sm">{listError}</p>
        ) : history.length === 0 ? (
          <p className="text-muted-foreground text-sm">이력이 없습니다.</p>
        ) : (
          <ul className="max-h-[200px] space-y-1 overflow-y-auto text-xs">
            {history.map((h) => (
              <li
                key={h.id}
                className="font-mono text-muted-foreground flex flex-wrap justify-between gap-1 border-b border-dashed py-1 last:border-0"
              >
                <span>{labelForKey(h.actuator_key)}</span>
                <span className="text-foreground">{h.state}</span>
                <span className="w-full shrink-0 sm:w-auto">
                  {new Date(h.recorded_at).toLocaleString("ko-KR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
