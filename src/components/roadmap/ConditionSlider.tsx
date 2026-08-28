"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 조건 값을 슬라이더로 바로 조정 → 디바운스 후 onCommit 호출.
 * 채팅으로 "월 저축액을 OO원으로 바꿔줘"라고 치는 대신 즉석 재시뮬레이션을 위한 컨트롤.
 */
export function ConditionSlider({
  label,
  value,
  min,
  max,
  step,
  formatValue,
  onCommit,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  formatValue: (v: number) => string;
  onCommit: (v: number) => void;
  disabled?: boolean;
}) {
  const [local, setLocal] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 외부(서버가 조정한 requestPatch 등)에서 값이 바뀌면 슬라이더도 따라간다.
  useEffect(() => setLocal(value), [value]);

  function handleChange(next: number) {
    setLocal(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onCommit(next), 700);
  }

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="font-semibold text-brand-700">{formatValue(local)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={local}
        disabled={disabled}
        onChange={(e) => handleChange(Number(e.target.value))}
        className="w-full accent-brand-600 disabled:opacity-50"
      />
    </div>
  );
}
