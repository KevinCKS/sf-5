"use client";

import { memo, useMemo, type ComponentType } from "react";
import {
  Droplets,
  FlaskConical,
  LineChart as LineChartIcon,
  Thermometer,
  Waves,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  SENSOR_PROGRESS_BAR_CLASS,
  SENSOR_RANGE_LABELS,
  SENSOR_TYPE_FILTERS,
  SENSOR_VALUE_BOUNDS,
  type SensorTypeId,
  sensorSeriesStroke,
  sensorTypeLabel,
} from "@/lib/sensors/constants";
import { cn } from "@/lib/utils";

/** Recharts margin·tick 객체를 렌더마다 새로 만들지 않음 */
const LINE_CHART_MARGIN = { top: 10, right: 10, left: 0, bottom: 0 } as const;
const AXIS_TICK_SM = { fontSize: 11 } as const;
/** Y축 숫자를 축선 쪽으로 당겨 플롯 가로 폭 확보 */
const Y_AXIS_TICK = { ...AXIS_TICK_SM, dx: 6 } as const;
const TOOLTIP_CONTENT_STYLE = { fontSize: 12 } as const;

/** CartesianGrid 세로 보조선 — X축 틱 좌표와 맞추고, 틱이 없으면 플롯 폭을 균등 분할 */
function sensorChartVerticalGridPoints(
  arg: {
    xAxis?: { ticks?: ReadonlyArray<{ coordinate?: number }> };
    offset: { left: number; width: number };
  },
  _syncWithTicks: boolean,
): number[] {
  const { left, width } = arg.offset;
  if (!Number.isFinite(left) || !Number.isFinite(width) || width <= 0) {
    return [];
  }
  const minX = left;
  const maxX = left + width;
  const fromTicks = (arg.xAxis?.ticks ?? [])
    .map((t) => t.coordinate)
    .filter(
      (c): c is number =>
        typeof c === "number" && Number.isFinite(c) && c >= minX - 2 && c <= maxX + 2,
    );
  const sorted = [...new Set(fromTicks)].sort((a, b) => a - b);
  if (sorted.length >= 2) {
    return sorted;
  }
  if (sorted.length === 1) {
    return [minX, sorted[0]!, maxX];
  }
  const segments = 5;
  return Array.from(
    { length: segments + 1 },
    (_, i) => minX + (width * i) / segments,
  );
}

/** 피벗 결과 한 점 — dynamic 청크에서 타입만 공유 */
export type SensorChartPoint = Record<string, string | number | null>;

/** 시계열에서 해당 센서 타입의 마지막 유효 점 인덱스(결측 제외) */
function lastLivePointIndex(
  data: SensorChartPoint[],
  dataKey: string,
): number {
  for (let j = data.length - 1; j >= 0; j--) {
    const v = data[j]?.[dataKey];
    if (v != null && typeof v === "number" && !Number.isNaN(v)) {
      return j;
    }
  }
  return -1;
}

type LiveHeadDotProps = {
  cx?: number;
  cy?: number;
  index?: number;
  stroke?: string;
};

/** 라인 최신점만 위쪽 삼각형 + SVG 발광 — markerKey 변경 시 CSS 깜빡임 재생 */
function renderLiveHeadDot(
  props: LiveHeadDotProps,
  opts: {
    lastIdx: number;
    strokeColor: string;
    markerKey: string;
    filterId: string;
    compact: boolean;
  },
) {
  const { cx, cy, index } = props;
  if (index !== opts.lastIdx || cx == null || cy == null || opts.lastIdx < 0) {
    return null;
  }
  // 조금 아래로 이동 · 폭은 좁게 · 세로(꼭짓점~밑변)는 조금 더 길게
  const dy = opts.compact ? 3 : 4;
  const r = opts.compact ? 6 : 9;
  const y = cy + dy;
  const halfW = r * 0.5;
  const apexUp = r * 1.22;
  const baseDown = r * 1.08;
  const pts = `${cx},${y - apexUp} ${cx - halfW},${y + baseDown} ${cx + halfW},${y + baseDown}`;
  return (
    <g key={opts.markerKey}>
      <defs>
        <filter
          id={opts.filterId}
          x="-80%"
          y="-80%"
          width="260%"
          height="260%"
        >
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <polygon
        points={pts}
        fill={opts.strokeColor}
        stroke={opts.strokeColor}
        strokeWidth={0.5}
        filter={`url(#${opts.filterId})`}
        className="sensor-live-head-triangle"
      />
    </g>
  );
}

type SensorSummaryCardsProps = {
  latest: Map<string, { value: number; unit: string | null }>;
  compact?: boolean;
};

const SENSOR_ICONS: Record<SensorTypeId, ComponentType<{ className?: string }>> =
  {
  temperature: Thermometer,
  humidity: Droplets,
  ec: Waves,
  ph: FlaskConical,
};

/** 측정값 + 단위 한 줄(참조 UI: 27.82°C 등) */
function formatSensorValueWithUnit(
  type: SensorTypeId,
  value: number,
  unit: string | null,
): string {
  const n = value.toFixed(2);
  if (unit?.trim()) {
    const u = unit.trim();
    if (u.startsWith("°") || u === "%" || u.endsWith("%")) return `${n}${u}`;
    return `${n} ${u}`;
  }
  switch (type) {
    case "temperature":
      return `${n}°C`;
    case "humidity":
      return `${n}%`;
    case "ec":
      return `${n} mS/cm`;
    case "ph":
      return `${n} pH`;
    default:
      return n;
  }
}

/** 상단 요약만 — 아이콘·값·범위·진행 바 */
const SensorSummaryCardsOnly = memo(function SensorSummaryCardsOnly({
  latest,
  compact = false,
}: SensorSummaryCardsProps) {
  const summaryCards = useMemo(
    () => SENSOR_TYPE_FILTERS.filter((f) => latest.has(f.type)),
    [latest],
  );

  return (
    <div
      className={
        compact
          ? "mt-2 grid grid-cols-2 gap-1.5"
          : "mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      }
    >
      {summaryCards.map(({ type, label }) => {
        const v = latest.get(type);
        if (!v) return null;
        const st = type as SensorTypeId;
        const bounds = SENSOR_VALUE_BOUNDS[st];
        const rangeLbl = SENSOR_RANGE_LABELS[st];
        const pct =
          bounds.max === bounds.min
            ? 0
            : Math.min(
                100,
                Math.max(
                  0,
                  ((v.value - bounds.min) / (bounds.max - bounds.min)) * 100,
                ),
              );
        const Icon = SENSOR_ICONS[st];
        const valueLine = formatSensorValueWithUnit(st, v.value, v.unit);
        return (
          <div
            key={type}
            className={
              compact
                ? "flex flex-col rounded-xl border-2 border-white/22 bg-gradient-to-b from-card/85 to-muted/40 px-2 py-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(0,0,0,0.12)]"
                : "flex flex-col rounded-2xl border-2 border-teal-400/35 bg-gradient-to-b from-card/92 to-muted/45 px-3 py-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_8px_24px_-12px_rgba(0,0,0,0.38)]"
            }
          >
            {/* 라벨과 측정값을 한 줄에 — 온도 옆 19.00°C 형태 */}
            <div className="flex min-w-0 items-center gap-2">
              <Icon
                className="size-4 shrink-0 text-primary sm:size-[1.125rem]"
                aria-hidden
              />
              <span className="text-foreground shrink-0 text-sm font-medium">
                {label}
              </span>
              <span
                className={cn(
                  "sensor-summary-value-neon min-w-0 flex-1 text-right font-bold tabular-nums",
                  st === "temperature" && "sensor-summary-value-neon-temperature",
                  compact
                    ? "text-lg leading-tight"
                    : "text-2xl leading-none sm:text-3xl",
                )}
              >
                {valueLine}
              </span>
            </div>
            <div className="text-muted-foreground mt-2 flex justify-between text-[10px] leading-none sm:text-[11px]">
              <span>{rangeLbl.min}</span>
              <span>{rangeLbl.max}</span>
            </div>
            <div
              className={
                compact
                  ? "mt-1 h-1 w-full overflow-hidden rounded-full bg-muted/70"
                  : "mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted/70"
              }
              role="presentation"
            >
              <div
                className={`h-full rounded-full ${SENSOR_PROGRESS_BAR_CLASS[st]}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
});

type SensorLineChartsOnlyProps = {
  typesList: string[];
  chartData: SensorChartPoint[];
  unitByType: Map<string, string | null>;
  compact?: boolean;
};

/** Recharts 구역만 — chartData 참조가 같으면 상단 요약 갱신과 독립 */
const SensorLineChartsOnly = memo(function SensorLineChartsOnly({
  typesList,
  chartData,
  unitByType,
  compact = false,
}: SensorLineChartsOnlyProps) {
  return (
    <div
      className={
        compact
          ? "mt-2 grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-2"
          : "mt-4 flex w-full min-w-0 flex-col gap-6"
      }
    >
      {typesList.map((ty, i) => {
        const label = sensorTypeLabel(ty);
        const unit = unitByType.get(ty);
        const strokeColor = sensorSeriesStroke(ty);
        const lastIdx = lastLivePointIndex(chartData, ty);
        const lastRow = lastIdx >= 0 ? chartData[lastIdx] : null;
        const markerKey =
          lastRow != null
            ? `${String(lastRow.time)}-${String(lastRow[ty])}-${ty}`
            : "none";
        const filterId = `sensor-live-glow-${i}`;
        return (
          <div
            key={ty}
            className="min-w-0 rounded-lg border border-white/16 bg-card/30 p-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
          >
            <p
              className={
                compact
                  ? "mb-0.5 text-xs font-medium text-foreground"
                  : "mb-1 text-sm font-medium text-foreground"
              }
            >
              {label}
              {unit ? (
                <span className="text-muted-foreground font-normal">
                  {" "}
                  ({unit})
                </span>
              ) : null}
            </p>
            <div
              className={
                compact ? "h-[min(120px,20vh)] w-full" : "h-[220px] w-full"
              }
            >
              {/* 리사이즈 시 차트 재측정 빈도 완화(레이아웃 스래싱 감소) */}
              <ResponsiveContainer
                width="100%"
                height="100%"
                debounce={200}
              >
                <LineChart data={chartData} margin={LINE_CHART_MARGIN}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted-foreground/25"
                    strokeWidth={0.85}
                    vertical
                    verticalCoordinatesGenerator={sensorChartVerticalGridPoints}
                  />
                  <XAxis
                    dataKey="timeLabel"
                    tick={AXIS_TICK_SM}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={Y_AXIS_TICK}
                    domain={["auto", "auto"]}
                    width={40}
                    tickMargin={3}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_CONTENT_STYLE}
                    isAnimationActive={false}
                  />
                  {/* 최신점 삼각형 마커 — 폴링으로 마지막 점이 바뀌면 key·애니메이션 재실행 */}
                  <Line
                    type="monotone"
                    dataKey={ty}
                    name={label}
                    stroke={strokeColor}
                    dot={(dotProps) =>
                      renderLiveHeadDot(dotProps, {
                        lastIdx,
                        strokeColor,
                        markerKey,
                        filterId,
                        compact,
                      })
                    }
                    connectNulls
                    isAnimationActive={false}
                    animateNewValues={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
});

type SensorLiveChartsProps = {
  latest: Map<string, { value: number; unit: string | null }>;
  typesList: string[];
  chartData: SensorChartPoint[];
  unitByType: Map<string, string | null>;
  /** 대시보드 홈 2열 — 차트 2×2·낮은 높이 */
  compact?: boolean;
};

/** 요약 카드·라인차트 — Recharts 를 별도 청크로 분리해 초기 JS 파싱 비용 감소 */
export const SensorLiveChartsBlock = memo(function SensorLiveChartsBlock({
  latest,
  typesList,
  chartData,
  unitByType,
  compact = false,
}: SensorLiveChartsProps) {
  return (
    <>
      <SensorSummaryCardsOnly latest={latest} compact={compact} />
      <SensorLineChartsOnly
        typesList={typesList}
        chartData={chartData}
        unitByType={unitByType}
        compact={compact}
      />
      {!compact ? (
        <p className="text-muted-foreground mt-2 flex items-start gap-2 text-xs">
          <LineChartIcon
            className="mt-0.5 size-3.5 shrink-0 text-primary/75"
            aria-hidden
          />
          <span>
            센서 타입마다 차트가 분리되어, 각각의 Y축이 해당 측정값 범위에 맞춰 표시됩니다.
          </span>
        </p>
      ) : null}
    </>
  );
});
