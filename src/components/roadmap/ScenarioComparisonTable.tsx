"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Scenario } from "@/types/api";

const won = (value?: number | null) =>
  value == null ? "-" : `${Math.round(value).toLocaleString("ko-KR")}원`;

/**
 * 추천+대안 카드 2개 뒤에, 서버가 계산한 전체 후보(적금·정책·투자·균형)를
 * 한눈에 비교할 수 있는 접이식 표. Roadmap-Agent가 `alternatives`에 나머지
 * 후보 전체를 실어 보내는 걸 그대로 활용 — 개수는 조건에 따라 0~여러 개.
 */
export function ScenarioComparisonTable({
  recommended,
  alternatives,
}: {
  recommended: Scenario;
  alternatives: Scenario[];
}) {
  const [open, setOpen] = useState(false);
  // 서버가 이미 점수 내림차순으로 정렬해서 주므로, 상위 5개만 잘라 보여준다.
  const rows = [recommended, ...alternatives].slice(0, 5);
  if (rows.length <= 1) return null;

  return (
    <details
      className="rounded-lg border border-slate-200 bg-white"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="flex items-center justify-between gap-2 px-4 py-3 text-xs font-semibold text-slate-700 cursor-pointer select-none list-none">
        <span>다른 시나리오도 비교해보기 ({rows.length}개)</span>
        <ChevronDown
          size={15}
          className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </summary>
      {/* 표(<table>)는 3열 레이아웃의 좁은 가운데 칸 안에서 5개 열이 들어갈
          공간이 없어, 긴 상품명·"원금 안정형" 같은 라벨이 한 글자씩
          줄바꿈되며 읽기 힘들어진다는 실사용자 피드백으로 카드 리스트로
          바꿨다 — 폭에 상관없이 자연스럽게 줄바꿈된다. */}
      <div className="divide-y divide-slate-100 border-t border-slate-200">
        {rows.map((s, i) => (
          <div key={s.id ?? i} className={`px-4 py-3 ${i === 0 ? "bg-brand-50/40" : ""}`}>
            <div className="flex items-start gap-1.5">
              {i === 0 && (
                <span className="mt-0.5 inline-block shrink-0 text-[10px] font-bold text-brand-700 bg-brand-100 rounded px-1.5 py-0.5">
                  추천
                </span>
              )}
              <span className="text-xs font-semibold text-slate-800 leading-snug">{s.title}</span>
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">{s.productType}</div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <div className="text-slate-400">원금</div>
                <div className="font-medium text-slate-700">{won(s.principal)}</div>
              </div>
              <div>
                <div className="text-slate-400">예상액</div>
                <div className="font-medium text-slate-700">{won(s.expectedAmount)}</div>
              </div>
              <div>
                <div className="text-slate-400">목표 달성률</div>
                <div className="font-medium text-slate-700">
                  {s.goalRate == null ? "-" : `${s.goalRate.toFixed(1)}%`}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
