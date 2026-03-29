"use client";

import { memo, useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SENSOR_TYPE_FILTERS, sensorTypeLabel } from "@/lib/sensors/constants";

/** 테마 --chart-* 는 oklch 이므로 hsl() 로 감싸지 않음 (감싸면 무효 색 → 선 미표시) */
const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

/** Recharts margin·tick 객체를 렌더마다 새로 만들지 않음 */
const LINE_CHART_MARGIN = { top: 8, right: 8, left: 0, bottom: 0 } as const;
const AXIS_TICK_SM = { fontSize: 11 } as const;
const TOOLTIP_CONTENT_STYLE = { fontSize: 12 } as const;

/** 피벗 결과 한 점 — dynamic 청크에서 타입만 공유 */
export type SensorChartPoint = Record<string, string | number | null>;

type SensorSummaryCardsProps = {
  latest: Map<string, { value: number; unit: string | null }>;
};

/** 상단 요약만 — latest 만 바뀌고 차트 데이터는 deferred 일 때 Recharts 재실행 생략 */
const SensorSummaryCardsOnly = memo(function SensorSummaryCardsOnly({
  latest,
}: SensorSummaryCardsProps) {
  const summaryCards = useMemo(
    () => SENSOR_TYPE_FILTERS.filter((f) => latest.has(f.type)),
    [latest],
  );

  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {summaryCards.map(({ type, label }) => {
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
      })}
    </div>
  );
});

type SensorLineChartsOnlyProps = {
  typesList: string[];
  chartData: SensorChartPoint[];
  unitByType: Map<string, string | null>;
};

/** Recharts 구역만 — chartData 참조가 같으면 상단 요약 갱신과 독립 */
const SensorLineChartsOnly = memo(function SensorLineChartsOnly({
  typesList,
  chartData,
  unitByType,
}: SensorLineChartsOnlyProps) {
  return (
    <div className="mt-4 flex w-full min-w-0 flex-col gap-6">
      {typesList.map((ty, i) => {
        const label = sensorTypeLabel(ty);
        const unit = unitByType.get(ty);
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
              {/* 리사이즈 시 차트 재측정 빈도 완화(레이아웃 스래싱 감소) */}
              <ResponsiveContainer
                width="100%"
                height="100%"
                debounce={200}
              >
                <LineChart data={chartData} margin={LINE_CHART_MARGIN}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />
                  <XAxis
                    dataKey="timeLabel"
                    tick={AXIS_TICK_SM}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={AXIS_TICK_SM} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={TOOLTIP_CONTENT_STYLE}
                    isAnimationActive={false}
                  />
                  {/* 폴링으로 시계열이 바뀔 때 신규 점만 별도 애니메이션하지 않음(Recharts 3) */}
                  <Line
                    type="monotone"
                    dataKey={ty}
                    name={label}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    dot={false}
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
};

/** 요약 카드·라인차트 — Recharts 를 별도 청크로 분리해 초기 JS 파싱 비용 감소 */
export const SensorLiveChartsBlock = memo(function SensorLiveChartsBlock({
  latest,
  typesList,
  chartData,
  unitByType,
}: SensorLiveChartsProps) {
  return (
    <>
      <SensorSummaryCardsOnly latest={latest} />
      <SensorLineChartsOnly
        typesList={typesList}
        chartData={chartData}
        unitByType={unitByType}
      />
      <p className="text-muted-foreground mt-2 text-xs">
        센서 타입마다 차트가 분리되어, 각각의 Y축이 해당 측정값 범위에 맞춰 표시됩니다.
      </p>
    </>
  );
});
