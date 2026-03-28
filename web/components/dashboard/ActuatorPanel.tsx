"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Gauge, Loader2, RefreshCw, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ACTUATOR_ROWS } from "@/lib/mqtt/actuatorTopics";
import { useMqttBrowser } from "@/components/dashboard/MqttBrowserBridge";
import {
  clearBrowserMqttSettings,
  getEnvDefaultMqttForm,
  normalizeActuatorCommandTopic,
  saveBrowserMqttSettings,
  type BrowserMqttSettings,
} from "@/lib/mqtt/browserMqttSettings";
import { parseResponseBodyJson } from "@/lib/http/parseResponseBodyJson";

type ActuatorControlRow = {
  id: string;
  actuator_key: string;
  state: string;
  recorded_at: string;
};

type HwRow = { state: string; updated_at: string };

type ActuatorPanelProps = {
  /** false: 좌측 패널에 토픽 설정이 있을 때(본문은 제어·상태만) */
  showMqttDetails?: boolean;
  /** false: DB 탭에서 이력만 둘 때 */
  showControls?: boolean;
  /** false: DB 탭에서 제어·이력만 분리할 때 */
  showHistory?: boolean;
};

/** 액츄에이터 ON/OFF — POST /api/mqtt/publish + 이력 + §6.3 보드 상태 */
export function ActuatorPanel({
  showMqttDetails = true,
  showControls = true,
  showHistory = true,
}: ActuatorPanelProps) {
  const [history, setHistory] = useState<ActuatorControlRow[]>([]);
  const [loadingList, setLoadingList] = useState(showHistory);
  const [listError, setListError] = useState<string | null>(null);
  const [hwByKey, setHwByKey] = useState<Record<string, HwRow>>({});
  const [hwError, setHwError] = useState<string | null>(null);
  const [loadingHw, setLoadingHw] = useState(showControls);
  /** 동일 행 연타·중복 요청만 막음(UI 비활성·스피너 없음) */
  const publishInFlightRef = useRef<Set<string>>(new Set());
  /** 서버 발행 성공 직후 표시(보드 §6.3 보고 전까지). 보드 updated_at 이 명령 시각 이후면 DB 값 우선 */
  const [commandEchoByKey, setCommandEchoByKey] = useState<
    Record<string, { state: "ON" | "OFF"; atMs: number }>
  >({});
  const [clearing, setClearing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [mqttSettingsHint, setMqttSettingsHint] = useState<string | null>(null);
  const { form: mqttForm, setForm: setMqttForm } = useMqttBrowser();

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
    if (!showHistory) return;
    void loadHistory();
  }, [loadHistory, showHistory]);

  useEffect(() => {
    if (!showControls) return;
    void loadHardware();
  }, [loadHardware, showControls]);

  useEffect(() => {
    if (!showControls) return;
    const h = () => void loadHardware({ silent: true });
    window.addEventListener("smartfarm-actuator-status-stored", h);
    return () => window.removeEventListener("smartfarm-actuator-status-stored", h);
  }, [loadHardware, showControls]);

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

  /** 브라우저 MQTT 설정 저장(Sensor 카드와 같은 키) */
  function handleSaveMqttSettings() {
    saveBrowserMqttSettings(mqttForm);
    setMqttSettingsHint(
      "이 브라우저에 저장했습니다. MQTT 연결을 끊었다가 다시 연결하면 §6.3 토픽이 적용됩니다.",
    );
    setActionError(null);
  }

  function handleClearMqttSettings() {
    clearBrowserMqttSettings();
    setMqttForm(getEnvDefaultMqttForm());
    setMqttSettingsHint(
      "저장값을 지웠습니다. env 기본값을 쓰려면 MQTT 연결을 다시 시도하세요.",
    );
  }

  /** 최근 이력 시각 — 24시간제 `YYYY-MM-DD HH:mm` (로컬) */
  function formatHistoryTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${day} ${hh}:${mm}`;
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
    <section className="dashboard-panel">
      <h2 className="text-base font-semibold tracking-tight">
        {showControls ? "Actuator" : showHistory ? "액추에이터 제어 이력" : "Actuator"}
      </h2>
      {showControls ? (
        <p className="mt-1 text-sm text-muted-foreground">
          §6.2: 명령 발행 후 이력 저장. 클릭 직후에는 <strong className="text-foreground font-medium">명령</strong> 배지로
          서버 발행 결과를 바로 보여 주고, §6.3 보드 MQTT 보고가 오면 <strong className="text-foreground font-medium">보드</strong> 값으로
          바뀝니다. 브로커·§6.3 구독은{" "}
          <strong className="text-foreground font-medium">localStorage</strong> 에 저장된 MQTT 설정과 같습니다.
        </p>
      ) : showHistory ? (
        <p className="text-muted-foreground mt-1 text-sm">
          actuator_controls 테이블에서 본인 명령 이력을 조회합니다.
        </p>
      ) : null}

      {showMqttDetails ? (
      <details className="group mt-3 space-y-2 rounded-md border bg-muted/30 px-2 py-2 text-xs">
        <summary className="cursor-pointer select-none font-medium text-foreground">
          연결·토픽 설정 (PRD §6.2·§6.3)
        </summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="actuator-mqtt-broker-url">브로커 WebSocket URL</Label>
            <Input
              id="actuator-mqtt-broker-url"
              type="url"
              autoComplete="off"
              placeholder="wss://…"
              value={mqttForm.brokerUrl}
              onChange={(e) =>
                setMqttForm((f) => ({ ...f, brokerUrl: e.target.value }))
              }
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="actuator-mqtt-user">사용자명</Label>
            <Input
              id="actuator-mqtt-user"
              autoComplete="off"
              value={mqttForm.username}
              onChange={(e) =>
                setMqttForm((f) => ({ ...f, username: e.target.value }))
              }
              className="text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="actuator-mqtt-pass">비밀번호</Label>
            <Input
              id="actuator-mqtt-pass"
              type="password"
              autoComplete="off"
              placeholder="비우면 .env 의 NEXT_PUBLIC_MQTT_PASSWORD"
              value={mqttForm.password}
              onChange={(e) =>
                setMqttForm((f) => ({ ...f, password: e.target.value }))
              }
              className="text-xs"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <div className="text-foreground font-medium">액추에이터 발행 토픽</div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              PRD §6.2·서버 allowlist·해당 액추 키와 일치할 때만 유지됩니다.
            </p>
            <div className="grid gap-2">
              {ACTUATOR_ROWS.map((row) => (
                <div
                  key={row.key}
                  className="grid gap-1 sm:grid-cols-[6rem_1fr] sm:items-center"
                >
                  <Label
                    htmlFor={`actuator-mqtt-cmd-${row.key}`}
                    className="text-[11px] sm:pt-0"
                  >
                    {row.label}
                  </Label>
                  <Input
                    id={`actuator-mqtt-cmd-${row.key}`}
                    autoComplete="off"
                    value={mqttForm.actuatorCommandTopics[row.key]}
                    onChange={(e) =>
                      setMqttForm((f) => ({
                        ...f,
                        actuatorCommandTopics: {
                          ...f.actuatorCommandTopics,
                          [row.key]: e.target.value,
                        } satisfies BrowserMqttSettings["actuatorCommandTopics"],
                      }))
                    }
                    className="font-mono text-xs"
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <div className="text-foreground font-medium">액추에이터 상태 구독 토픽</div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              비우거나 잘못된 값은 저장 시 PRD 기본으로 맞춥니다.
            </p>
            <div className="grid gap-2">
              {ACTUATOR_ROWS.map((row) => (
                <div
                  key={row.key}
                  className="grid gap-1 sm:grid-cols-[6rem_1fr] sm:items-center"
                >
                  <Label
                    htmlFor={`actuator-mqtt-st-${row.key}`}
                    className="text-[11px] sm:pt-0"
                  >
                    {row.label}
                  </Label>
                  <Input
                    id={`actuator-mqtt-st-${row.key}`}
                    autoComplete="off"
                    value={mqttForm.actuatorStatusSubscribeTopics[row.key]}
                    onChange={(e) =>
                      setMqttForm((f) => ({
                        ...f,
                        actuatorStatusSubscribeTopics: {
                          ...f.actuatorStatusSubscribeTopics,
                          [row.key]: e.target.value,
                        } satisfies BrowserMqttSettings["actuatorStatusSubscribeTopics"],
                      }))
                    }
                    className="font-mono text-xs"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="button" size="sm" variant="secondary" onClick={handleSaveMqttSettings}>
            이 브라우저에 저장
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={handleClearMqttSettings}>
            저장 지우기(env만)
          </Button>
        </div>
      </details>
      ) : null}
      {showMqttDetails && mqttSettingsHint ? (
        <p className="text-muted-foreground mt-2 text-xs">{mqttSettingsHint}</p>
      ) : null}

      {showControls && hwError ? (
        <p className="text-destructive mt-2 text-xs" role="status">
          {hwError}
        </p>
      ) : null}

      {showControls ? (
      <>
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
                  onClick={() =>
                    void publishState(
                      normalizeActuatorCommandTopic(
                        row.key,
                        mqttForm.actuatorCommandTopics[row.key],
                      ),
                      "ON",
                      row.key,
                    )
                  }
                >
                  ON
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-w-[4.25rem]"
                  onClick={() =>
                    void publishState(
                      normalizeActuatorCommandTopic(
                        row.key,
                        mqttForm.actuatorCommandTopics[row.key],
                      ),
                      "OFF",
                      row.key,
                    )
                  }
                >
                  OFF
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      </>
      ) : null}

      {actionError ? (
        <p className="text-destructive mt-3 text-sm" role="alert">
          {actionError}
        </p>
      ) : null}

      {showHistory ? (
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
          <ul className="max-h-[200px] space-y-0 overflow-y-auto text-xs">
            {history.map((h) => (
              <li
                key={h.id}
                className="text-muted-foreground grid grid-cols-[minmax(0,1fr)_2.75rem_8.5rem] items-center gap-x-2 border-b border-dashed py-1.5 last:border-0"
              >
                <span className="min-w-0 truncate font-sans">{labelForKey(h.actuator_key)}</span>
                <span className="text-foreground w-full text-center font-mono tabular-nums">
                  {h.state}
                </span>
                <span className="shrink-0 text-right font-mono text-[11px] tabular-nums">
                  {formatHistoryTime(h.recorded_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      ) : null}
    </section>
  );
}
