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
import {
  Braces,
  Droplets,
  Fan,
  Gauge,
  History,
  Lightbulb,
  Loader2,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ACTUATOR_ROWS } from "@/lib/mqtt/actuatorTopics";
import { useMqttForm } from "@/components/dashboard/MqttBrowserBridge";
import {
  clearBrowserMqttSettings,
  getEnvDefaultMqttForm,
  normalizeActuatorCommandTopic,
  saveBrowserMqttSettings,
  type BrowserMqttSettings,
} from "@/lib/mqtt/browserMqttSettings";
import {
  dashboardFetchInit,
  dashboardJsonFetchInit,
} from "@/lib/http/dashboardFetchInit";
import { parseResponseBodyJson } from "@/lib/http/parseResponseBodyJson";
import { formatShortDateTime } from "@/lib/datetime/koShortDateTime";
import { cn } from "@/lib/utils";

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
  /** true: 대시보드 홈 2열 — 설명·카드 패딩 축소 */
  compactHome?: boolean;
};

/** 이력 한 줄 — actionError·로딩만 바뀔 때 동일 행 재렌더 생략 */
const ActuatorHistoryListItem = memo(function ActuatorHistoryListItem({
  rowLabel,
  state,
  timeLabel,
}: {
  rowLabel: string;
  state: string;
  timeLabel: string;
}) {
  return (
    <li className="[contain-intrinsic-size:auto_2.25rem] [content-visibility:auto] text-muted-foreground grid grid-cols-[minmax(0,1fr)_2.75rem_8.5rem] items-center gap-x-2 border-b border-dashed py-1.5 last:border-0">
      <span className="min-w-0 truncate font-sans">{rowLabel}</span>
      <span className="text-foreground w-full text-center font-mono tabular-nums">
        {state}
      </span>
      <span className="shrink-0 text-right font-mono text-[11px] tabular-nums">
        {timeLabel}
      </span>
    </li>
  );
});

type ActuatorDisplayResolved = {
  state: string | undefined;
  variant: "board" | "command";
  /** 명령 시각 또는 보드 갱신 시각(짧은 포맷) */
  timeLabel: string;
};

function labelForActuatorKey(key: string) {
  return ACTUATOR_ROWS.find((r) => r.key === key)?.label ?? key;
}

/** actuator_controls 이력 행이 동일하면 참조 유지 */
function sameActuatorControlRows(
  a: ActuatorControlRow[],
  b: ActuatorControlRow[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (
      x.id !== y.id ||
      x.actuator_key !== y.actuator_key ||
      x.state !== y.state ||
      x.recorded_at !== y.recorded_at
    ) {
      return false;
    }
  }
  return true;
}

/** actuator_status 맵이 키·값 동일하면 참조 유지 */
function sameHwByKeyRecord(
  a: Record<string, HwRow>,
  b: Record<string, HwRow>,
): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysB) {
    const ra = a[k];
    const rb = b[k];
    if (
      !ra ||
      !rb ||
      ra.state !== rb.state ||
      ra.updated_at !== rb.updated_at
    ) {
      return false;
    }
  }
  return true;
}

/** 보드 DB vs 명령 에코 표시 — useMemo 에서 재계산 범위 한정 */
function computeActuatorDisplay(
  rowKey: string,
  hwByKey: Record<string, HwRow>,
  commandEchoByKey: Record<string, { state: "ON" | "OFF"; atMs: number }>,
): ActuatorDisplayResolved {
  const hw = hwByKey[rowKey];
  const echo = commandEchoByKey[rowKey];
  const hwTime = hw?.updated_at ? new Date(hw.updated_at).getTime() : 0;
  if (echo && (!hw?.updated_at || hwTime < echo.atMs)) {
    return {
      state: echo.state,
      variant: "command",
      timeLabel: formatShortDateTime(echo.atMs),
    };
  }
  return {
    state: hw?.state,
    variant: "board",
    timeLabel: hw?.updated_at
      ? formatShortDateTime(hw.updated_at)
      : "갱신 시각 —",
  };
}

/** ON/OFF 배지 — 제어 카드 memo 와 공유 */
function actuatorStateBadge(
  state: string | undefined,
  variant: "board" | "command" = "board",
  compact = false,
) {
  const sizeCn = compact
    ? "px-2 py-0.5 text-xs font-semibold leading-none"
    : "px-2 py-0.5 text-xs";
  if (!state) {
    return (
      <span className={cn("text-muted-foreground font-mono tabular-nums", sizeCn)}>
        —
      </span>
    );
  }
  const on = state === "ON";
  /** 명령 에코(보드 확인 전): 주황 — ON/OFF 모두 동일 톤 */
  if (variant === "command") {
    return (
      <span
        className={cn(
          "inline-flex rounded-md border border-orange-500/50 bg-orange-500/15 font-mono font-semibold text-orange-950 dark:text-orange-100",
          sizeCn,
        )}
      >
        {state}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex rounded-md border font-mono",
        sizeCn,
        on
          ? "border-emerald-500/40 bg-emerald-500/15 font-semibold text-emerald-800 dark:text-emerald-200"
          : "border-muted-foreground/30 bg-muted/50 font-medium text-muted-foreground",
      )}
    >
      {state}
    </span>
  );
}

type ActuatorRowDef = (typeof ACTUATOR_ROWS)[number];

type ActuatorControlCardProps = {
  row: ActuatorRowDef;
  disp: ActuatorDisplayResolved;
  commandTopic: string;
  publishState: (
    topic: string,
    state: "ON" | "OFF",
    rowKey: string,
  ) => Promise<void>;
  compact?: boolean;
  /** true: ON/OFF 클릭 후 — 「명령」 라벨(아이콘+글자) 숨김 */
  hideCommandLabel?: boolean;
};

/** 참조 UI: ON/OFF 각각 알약 버튼 + 메탈 손잡이가 선택 쪽(ON=좌, OFF=우)으로 이동 */
function ActuatorOnOffToggle({
  state,
  onOn,
  onOff,
  compact = false,
}: {
  state: string | undefined;
  onOn: () => void;
  onOff: () => void;
  compact?: boolean;
}) {
  const isOn = state === "ON";
  const isOff = state === "OFF";
  /** 알약 높이 대비 여백 두도록 구슬 지름 축소 — thumbLeft 는 지름의 절반과 동기 */
  const knobHalf = compact ? "0.975rem" : "0.85rem";
  /** gap-1(0.25rem) 두 열 — ON이면 좌측 알약 중심, 그 외(OFF·미확인)는 우측 */
  const thumbLeft =
    state === "ON"
      ? `calc((100% - 0.25rem) / 4 - ${knobHalf})`
      : `calc(3 * (100% - 0.25rem) / 4 + 0.25rem - ${knobHalf})`;

  const pillClass = cn(
    "relative z-10 min-h-0 min-w-0 flex-1 rounded-full border-2 py-0 text-center transition-[color,box-shadow,border-color,background] duration-150 ease-out select-none focus:outline-none active:scale-100",
    "bg-gradient-to-b from-zinc-700/55 via-zinc-800/78 to-zinc-950/92 text-zinc-300",
    "text-[10px] font-extrabold uppercase tracking-wide sm:text-[11px]",
    "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400/40",
  );

  return (
    <div
      className={cn(
        "relative isolate box-border flex shrink-0 items-stretch gap-1 overflow-visible",
        compact
          ? "h-10 w-[7.5rem] min-h-10 max-h-10 min-w-[7.5rem] max-w-[7.5rem]"
          : "h-9 w-[7.25rem] min-h-9 max-h-9 min-w-[7.25rem] max-w-[7.25rem]",
      )}
      role="group"
      aria-label="ON/OFF 제어"
    >
      {/* 메탈 손잡이 — 선택된 알약 중앙(ON=좌·OFF=우), 글자는 버튼 층에서 표시 */}
      <div
        className={cn(
          "pointer-events-none absolute top-1/2 z-[5] -translate-y-1/2 rounded-full transition-[left,box-shadow] duration-75 ease-out",
          compact
            ? "size-[1.95rem] border border-amber-200/55 bg-[radial-gradient(circle_at_32%_26%,oklch(0.99_0.09_98)_0%,oklch(0.93_0.075_97)_12%,oklch(0.76_0.058_96)_32%,oklch(0.51_0.048_95)_55%,oklch(0.34_0.042_94)_76%,oklch(0.26_0.038_96)_100%)] shadow-[0_5px_18px_rgba(0,0,0,0.9),0_2px_6px_rgba(0,0,0,0.55),0_0_18px_rgba(250,204,21,0.26),0_0_26px_rgba(253,230,138,0.22),inset_0_3px_6px_rgba(254,240,180,0.55),inset_0_2px_4px_rgba(255,251,235,0.38),inset_0_-5px_10px_rgba(0,0,0,0.52),inset_0_-2px_3px_rgba(250,230,150,0.12)]"
            : "size-[1.7rem] border border-amber-200/50 bg-[radial-gradient(circle_at_34%_28%,oklch(0.99_0.085_98)_0%,oklch(0.91_0.068_97)_14%,oklch(0.69_0.052_96)_38%,oklch(0.45_0.044_95)_58%,oklch(0.30_0.038_94)_82%,oklch(0.23_0.034_96)_100%)] shadow-[0_4px_16px_rgba(0,0,0,0.85),0_2px_5px_rgba(0,0,0,0.5),0_0_16px_rgba(250,204,21,0.22),0_0_22px_rgba(253,230,138,0.18),inset_0_2px_5px_rgba(254,236,170,0.5),inset_0_2px_3px_rgba(255,250,230,0.35),inset_0_-4px_9px_rgba(0,0,0,0.5),inset_0_-2px_2px_rgba(248,220,130,0.1)]",
        )}
        style={{ left: thumbLeft }}
        aria-hidden
      />
      <button
        type="button"
        aria-label="ON 발행"
        aria-pressed={isOn}
        className={cn(
          pillClass,
          isOn
            ? "border-emerald-300/90 text-emerald-50 shadow-[0_0_18px_-4px_rgba(52,211,153,0.75),0_0_36px_-12px_rgba(16,185,129,0.45),inset_0_2px_10px_rgba(0,0,0,0.42),inset_0_-2px_12px_rgba(16,185,129,0.2)]"
            : "border-zinc-500/65 text-zinc-400 shadow-[inset_0_3px_10px_rgba(0,0,0,0.52),inset_0_-1px_0_rgba(255,255,255,0.06),0_3px_8px_rgba(0,0,0,0.48)]",
          !isOn && !isOff && "text-zinc-400",
        )}
        onClick={onOn}
      >
        ON
      </button>
      <button
        type="button"
        aria-label="OFF 발행"
        aria-pressed={isOff}
        className={cn(
          pillClass,
          "focus-visible:ring-zinc-400/40",
          isOff
            ? "border-zinc-100/50 text-zinc-50 shadow-[0_0_16px_-4px_rgba(228,228,231,0.55),0_0_30px_-10px_rgba(161,161,170,0.3),inset_0_2px_10px_rgba(0,0,0,0.45),inset_0_-1px_0_rgba(255,255,255,0.1)]"
            : "border-zinc-600/75 text-zinc-400 shadow-[inset_0_3px_10px_rgba(0,0,0,0.55),inset_0_-1px_0_rgba(255,255,255,0.05),0_3px_8px_rgba(0,0,0,0.42)]",
        )}
        onClick={onOff}
      >
        OFF
      </button>
    </div>
  );
}

/** compact 제목 줄 오른쪽 — 액추 종류별 아이콘(ACTUATOR_ROWS 키와 동일) */
function ActuatorRowKindIcon({ rowKey }: { rowKey: ActuatorRowDef["key"] }) {
  const cls =
    "size-4 shrink-0 text-primary/85 drop-shadow-[0_0_6px_oklch(0.62_0.12_175_/0.35)] sm:size-[1.125rem]";
  switch (rowKey) {
    case "led":
      return <Lightbulb className={cls} aria-hidden />;
    case "pump":
      return <Droplets className={cls} aria-hidden />;
    case "fan1":
    case "fan2":
      return <Fan className={cls} aria-hidden />;
    default:
      return <Gauge className={cls} aria-hidden />;
  }
}

/** 원격 제어 카드 한 장 — 다른 액추의 hw·disp 만 바뀔 때 나머지 카드 리렌더 생략 */
const ActuatorControlCard = memo(function ActuatorControlCard({
  row,
  disp,
  commandTopic,
  publishState,
  compact = false,
  hideCommandLabel = false,
}: ActuatorControlCardProps) {
  return (
    <div
      className={cn(
        "dashboard-nest-actuator-row",
        compact
          ? "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5 rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5"
          : "flex flex-wrap items-stretch justify-between gap-3 px-3 py-3",
      )}
    >
      <div className={cn("min-w-0", compact ? "space-y-0.5" : "space-y-2")}>
        <div
          className={cn(
            "flex min-w-0 items-center gap-2",
            compact ? "justify-between" : "w-full justify-between",
          )}
        >
          <span
            className={
              compact
                ? "min-w-0 flex-1 truncate text-xs font-semibold leading-tight tracking-tight"
                : "min-w-0 flex-1 text-sm font-medium leading-none"
            }
          >
            {row.label}
          </span>
          <span
            className={cn(
              "shrink-0 pl-0.5 sm:pl-1",
              compact && "self-center",
            )}
            title={
              row.key === "led"
                ? "조명(LED)"
                : row.key === "pump"
                  ? "펌프"
                  : "팬"
            }
          >
            <ActuatorRowKindIcon rowKey={row.key} />
          </span>
        </div>
        {compact ? (
          <>
            {disp.variant === "command" && !hideCommandLabel ? (
              <div
                className="text-muted-foreground inline-flex items-center gap-1 text-[10px] leading-tight"
                title="서버가 MQTT 발행까지 완료(§6.3 보고 전)"
              >
                <Send
                  className="text-sky-600/90 dark:text-sky-400 h-3 w-3 shrink-0"
                  aria-hidden
                />
                <span className="whitespace-nowrap">명령</span>
              </div>
            ) : null}
            <div className="flex min-h-[1.25rem] items-center">
              {actuatorStateBadge(disp.state, disp.variant, true)}
            </div>
            <p className="text-muted-foreground/90 w-full min-w-0 max-w-full overflow-x-auto font-mono text-[8px] leading-none tracking-tight tabular-nums whitespace-nowrap [scrollbar-width:none] sm:text-[9px]">
              {disp.timeLabel}
            </p>
          </>
        ) : (
          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
            {disp.variant === "command" && !hideCommandLabel ? (
              <span
                className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap"
                title="서버가 MQTT 발행까지 완료(§6.3 보고 전)"
              >
                <Send className="text-sky-600/90 dark:text-sky-400 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>명령</span>
              </span>
            ) : null}
            <span className="shrink-0">{actuatorStateBadge(disp.state, disp.variant)}</span>
            <span
              className={cn(
                "text-muted-foreground max-w-[min(100%,14rem)] font-mono leading-snug tabular-nums sm:max-w-none",
                "text-[11px]",
              )}
            >
              {disp.timeLabel}
            </span>
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center">
        <ActuatorOnOffToggle
          state={disp.state}
          compact={compact}
          onOn={() => void publishState(commandTopic, "ON", row.key)}
          onOff={() => void publishState(commandTopic, "OFF", row.key)}
        />
      </div>
    </div>
  );
});

/** 액츄에이터 ON/OFF — POST /api/mqtt/publish + 이력 + §6.3 보드 상태 */
export function ActuatorPanel({
  showMqttDetails = true,
  showControls = true,
  showHistory = true,
  compactHome = false,
}: ActuatorPanelProps) {
  const [history, setHistory] = useState<ActuatorControlRow[]>([]);
  const [loadingList, setLoadingList] = useState(showHistory);
  const [listError, setListError] = useState<string | null>(null);
  const [hwByKey, setHwByKey] = useState<Record<string, HwRow>>({});
  const [hwError, setHwError] = useState<string | null>(null);
  /** 서버 발행 성공 직후 표시(보드 §6.3 보고 전까지). 보드 updated_at 이 명령 시각 이후면 DB 값 우선 */
  const [commandEchoByKey, setCommandEchoByKey] = useState<
    Record<string, { state: "ON" | "OFF"; atMs: number }>
  >({});
  const [clearing, setClearing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [mqttSettingsHint, setMqttSettingsHint] = useState<string | null>(null);
  /** 액추 ON/OFF 클릭 후 「명령」 라벨 숨김 */
  const [hideActuatorAuxUi, setHideActuatorAuxUi] = useState(false);
  const { form: mqttForm, setForm: setMqttForm } = useMqttForm();

  /** 제어 카드 — mqttForm·기타 입력만 바뀔 때 보드 표시 로직 재실행 방지 */
  const actuatorCardDisplays = useMemo(
    () =>
      ACTUATOR_ROWS.map((row) => ({
        row,
        disp: computeActuatorDisplay(row.key, hwByKey, commandEchoByKey),
      })),
    [hwByKey, commandEchoByKey],
  );

  /** 이력 목록 — 동일 recorded_at·actuator_key 는 포맷/라벨 1회만 */
  const historyRowsPrepared = useMemo(() => {
    const timeLabelByRecorded = new Map<string, string>();
    const rowLabelByKey = new Map<string, string>();
    return history.map((h) => {
      let timeLabel = timeLabelByRecorded.get(h.recorded_at);
      if (timeLabel === undefined) {
        timeLabel = formatShortDateTime(h.recorded_at);
        timeLabelByRecorded.set(h.recorded_at, timeLabel);
      }
      let rowLabel = rowLabelByKey.get(h.actuator_key);
      if (rowLabel === undefined) {
        rowLabel = labelForActuatorKey(h.actuator_key);
        rowLabelByKey.set(h.actuator_key, rowLabel);
      }
      return {
        id: h.id,
        state: h.state,
        timeLabel,
        rowLabel,
      };
    });
  }, [history]);

  /** 이력·보드 상태 요청 경쟁 시 취소·stale 무시 */
  const historySeqRef = useRef(0);
  const historyAbortRef = useRef<AbortController | null>(null);
  const hwSeqRef = useRef(0);
  const hwAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      historyAbortRef.current?.abort();
      hwAbortRef.current?.abort();
    };
  }, []);

  const loadHistory = useCallback(async () => {
    const seq = ++historySeqRef.current;
    historyAbortRef.current?.abort();
    const ac = new AbortController();
    historyAbortRef.current = ac;

    setListError(null);
    try {
      const res = await fetch(
        "/api/actuator-controls?limit=25",
        dashboardFetchInit(ac.signal),
      );
      if (seq !== historySeqRef.current) return;
      const parsed = await parseResponseBodyJson<{ rows?: ActuatorControlRow[]; error?: string }>(
        res,
      );
      if (seq !== historySeqRef.current) return;
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
      const nextHistory = parsed.data.rows ?? [];
      setHistory((prev) =>
        sameActuatorControlRows(prev, nextHistory) ? prev : nextHistory,
      );
    } catch {
      if (seq !== historySeqRef.current) return;
      if (ac.signal.aborted) return;
      setListError("네트워크 오류가 발생했습니다.");
      setHistory([]);
    } finally {
      if (seq === historySeqRef.current) {
        setLoadingList(false);
      }
    }
  }, []);

  /** PRD §6.3 — actuator_status(보드가 MQTT로 보고한 최신 상태) */
  const loadHardware = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    const seq = ++hwSeqRef.current;
    hwAbortRef.current?.abort();
    const ac = new AbortController();
    hwAbortRef.current = ac;

    if (!silent) {
      setHwError(null);
    }
    try {
      const res = await fetch(
        "/api/actuators/status",
        dashboardFetchInit(ac.signal, { silent }),
      );
      if (seq !== hwSeqRef.current) return;
      const parsed = await parseResponseBodyJson<{
        rows?: { actuator_key: string; state: string; updated_at: string }[];
        error?: string;
      }>(res);
      if (seq !== hwSeqRef.current) return;
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
      const applyHw = () => {
        setHwByKey((prev) =>
          sameHwByKeyRecord(prev, next) ? prev : next,
        );
      };
      if (silent) startTransition(applyHw);
      else applyHw();
    } catch {
      if (seq !== hwSeqRef.current) return;
      if (ac.signal.aborted) return;
      setHwError("네트워크 오류가 발생했습니다.");
      setHwByKey({});
    }
  }, []);

  /** 이력·보드 상태를 동시에 요청해 초기 로드 대기 시간 단축 */
  useEffect(() => {
    const tasks: Promise<void>[] = [];
    if (showHistory) tasks.push(loadHistory());
    if (showControls) tasks.push(loadHardware());
    if (tasks.length === 0) return;
    void Promise.all(tasks);
  }, [loadHistory, loadHardware, showHistory, showControls]);

  useEffect(() => {
    if (!showControls) return;
    const h = () => void loadHardware({ silent: true });
    window.addEventListener("smartfarm-actuator-status-stored", h);
    return () => window.removeEventListener("smartfarm-actuator-status-stored", h);
  }, [loadHardware, showControls]);

  const publishState = useCallback(
    async (topic: string, state: "ON" | "OFF", rowKey: string) => {
      setActionError(null);
      setHideActuatorAuxUi(true);

      /** 낙관적 UI — 클릭 즉시 손잡이·상태배지(주황). 연타 허용, echoAtMs 로 오래된 응답만 롤백. */
      const echoAtMs = Date.now();
      setCommandEchoByKey((prev) => ({
        ...prev,
        [rowKey]: { state, atMs: echoAtMs },
      }));

      const revertIfStillThisEcho = () => {
        setCommandEchoByKey((prev) => {
          if (prev[rowKey]?.atMs !== echoAtMs) return prev;
          const next = { ...prev };
          delete next[rowKey];
          return next;
        });
      };

      try {
        const res = await fetch("/api/mqtt/publish", {
          method: "POST",
          ...dashboardJsonFetchInit({
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topic, payload: { state } }),
          }),
        });
        const parsed = await parseResponseBodyJson<{
          ok?: boolean;
          error?: string;
          topic?: string;
          mqttOk?: boolean;
        }>(res);
        if (!parsed.parseOk) {
          revertIfStillThisEcho();
          setHideActuatorAuxUi(false);
          setActionError(parsed.fallbackMessage);
          return;
        }
        const json = parsed.data;
        if (!res.ok) {
          revertIfStillThisEcho();
          setHideActuatorAuxUi(false);
          setActionError(json.error ?? `HTTP ${res.status}`);
          return;
        }
        void Promise.all([
          loadHistory(),
          loadHardware({ silent: true }),
        ]);
      } catch {
        revertIfStillThisEcho();
        setHideActuatorAuxUi(false);
        setActionError("네트워크 오류가 발생했습니다.");
      }
    },
    [loadHistory, loadHardware],
  );

  /** 본인 actuator_controls 이력 전체 삭제 */
  const clearHistory = useCallback(async () => {
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
        ...dashboardJsonFetchInit(),
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
  }, [loadHistory]);

  /** 브라우저 MQTT 설정 저장(Sensor 카드와 같은 키) */
  const handleSaveMqttSettings = useCallback(() => {
    saveBrowserMqttSettings(mqttForm);
    setActionError(null);
  }, [mqttForm]);

  const handleClearMqttSettings = useCallback(() => {
    clearBrowserMqttSettings();
    setMqttForm(getEnvDefaultMqttForm());
    setMqttSettingsHint(
      "저장값을 지웠습니다. env 기본값을 쓰려면 MQTT 연결을 다시 시도하세요.",
    );
  }, [setMqttForm]);

  const onClearHistoryClick = useCallback(() => {
    void clearHistory();
  }, [clearHistory]);

  return (
    <section
      className={cn(
        "dashboard-panel",
        compactHome && "flex h-full min-h-0 flex-col",
      )}
    >
      {showControls && compactHome ? (
        <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-x-2 gap-y-0">
          <h2 className="flex shrink-0 items-center gap-1.5 text-sm font-semibold tracking-tight">
            <Gauge className="size-4 shrink-0 text-primary" aria-hidden />
            Actuator
          </h2>
          <p className="text-muted-foreground min-w-0 text-[10px] leading-tight">
            <span className="font-semibold text-foreground">ON/OFF</span>
            {" · "}
            <span className="text-foreground/90">상태</span>
            {" · "}
            <span className="text-foreground/90">제어</span>
          </p>
        </div>
      ) : (
        <>
          <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <Gauge className="size-5 shrink-0 text-primary" aria-hidden />
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
        </>
      )}

      {showMqttDetails ? (
      <details className="group mt-3 space-y-2 rounded-md border bg-muted/30 px-2 py-2 text-xs">
        <summary className="cursor-pointer select-none font-medium text-foreground">
          <span className="inline-flex items-center gap-2">
            <Send className="size-3.5 shrink-0 text-primary/85" aria-hidden />
            연결·토픽 설정 (PRD §6.2·§6.3)
          </span>
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
            <div className="text-foreground font-medium">명령 발행 토픽</div>
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
            <div className="text-foreground font-medium">상태 구독 토픽</div>
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
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          <Button type="button" size="sm" variant="secondary" onClick={handleSaveMqttSettings}>
            <Save className="mr-1.5 size-3.5 shrink-0" aria-hidden />
            저장
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={handleClearMqttSettings}>
            <Braces className="mr-1.5 size-3.5 shrink-0" aria-hidden />
            환경변수
          </Button>
        </div>
      </details>
      ) : null}
      {showMqttDetails && mqttSettingsHint ? (
        <p className="text-muted-foreground mt-2 text-xs">{mqttSettingsHint}</p>
      ) : null}

      {showControls && hwError ? (
        <p
          className={cn(
            "text-destructive mt-2 text-xs",
            compactHome && "shrink-0",
          )}
          role="status"
        >
          {hwError}
        </p>
      ) : null}

      {showControls ? (
        <div
          className={cn(
            "dashboard-nest-actuator",
            compactHome
              ? "mt-2 flex min-h-0 flex-1 flex-col !p-4 sm:!p-5"
              : "mt-4",
          )}
        >
          <div
            className={cn(
              "shrink-0 border-b border-dashed border-white/22",
              compactHome
                ? "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 pb-2"
                : "flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pb-3",
            )}
          >
            {/* 왼쪽: 상태(보드)·오른쪽: 제어(토글 열) — 카드 그리드와 동일 폭 정렬 */}
            <div
              className={cn(
                "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1",
                compactHome ? "col-start-1" : "",
              )}
            >
              <h3 className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground">
                <Gauge className="size-3.5 shrink-0 text-primary/70" aria-hidden />
                상태
              </h3>
            </div>
            <div
              className={cn(
                "flex shrink-0 items-center justify-center text-xs font-medium tracking-wide text-muted-foreground",
                compactHome
                  ? "col-start-2 w-[7.5rem] justify-self-end"
                  : "w-[7.25rem] justify-center",
              )}
            >
              제어
            </div>
          </div>

          <div
            className={
              compactHome
                ? "mt-3 flex min-h-0 flex-1 flex-col gap-4 sm:gap-5"
                : "mt-3 space-y-3"
            }
          >
            {actuatorCardDisplays.map(({ row, disp }) => {
              const commandTopic = normalizeActuatorCommandTopic(
                row.key,
                mqttForm.actuatorCommandTopics[row.key],
              );
              return (
                <ActuatorControlCard
                  key={row.key}
                  row={row}
                  disp={disp}
                  commandTopic={commandTopic}
                  publishState={publishState}
                  compact={compactHome}
                  hideCommandLabel={hideActuatorAuxUi}
                />
              );
            })}
          </div>
        </div>
      ) : null}

      {actionError ? (
        <p className="text-destructive mt-3 text-sm" role="alert">
          {actionError}
        </p>
      ) : null}

      {showHistory ? (
      <div className="mt-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <History className="size-3.5 shrink-0 text-primary/70" aria-hidden />
            최근 이력
          </h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-destructive border-destructive/40 hover:bg-destructive/10"
            disabled={clearing || loadingList || history.length === 0}
            onClick={onClearHistoryClick}
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
            {historyRowsPrepared.map((h) => (
              <ActuatorHistoryListItem
                key={h.id}
                rowLabel={h.rowLabel}
                state={h.state}
                timeLabel={h.timeLabel}
              />
            ))}
          </ul>
        )}
      </div>
      ) : null}
    </section>
  );
}
