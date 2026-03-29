"use client";

import { memo } from "react";

type SensorTypeCheckboxProps = {
  type: string;
  label: string;
  checked: boolean;
  onToggle: (type: string) => void;
};

/** 센서 타입 필터 한 칸 — 상위가 폴링·행 갱신만 할 때 체크 UI 재렌더 생략 */
export const SensorTypeCheckbox = memo(function SensorTypeCheckbox({
  type,
  label,
  checked,
  onToggle,
}: SensorTypeCheckboxProps) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(type)}
        className="accent-primary h-4 w-4 rounded border"
      />
      {label}
    </label>
  );
});
