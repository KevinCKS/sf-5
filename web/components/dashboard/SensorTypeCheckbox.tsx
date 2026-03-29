"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";

type SensorTypeCheckboxProps = {
  type: string;
  label: string;
  checked: boolean;
  onToggle: (type: string) => void;
  /** true: 홈 대시보드 — 글자·체크박스 축소 */
  compact?: boolean;
};

/** 센서 타입 필터 한 칸 — 상위가 폴링·행 갱신만 할 때 체크 UI 재렌더 생략 */
export const SensorTypeCheckbox = memo(function SensorTypeCheckbox({
  type,
  label,
  checked,
  onToggle,
  compact = false,
}: SensorTypeCheckboxProps) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center",
        compact ? "gap-1 text-[11px] leading-none" : "gap-2 text-sm",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(type)}
        className={cn(
          "accent-primary rounded border",
          compact ? "h-3 w-3 shrink-0" : "h-4 w-4",
        )}
      />
      {label}
    </label>
  );
});
