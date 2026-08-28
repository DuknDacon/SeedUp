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
      <div className="overflow-x-auto border-t border-slate-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500 bg-slate-50">
              <th className="px-3 py-2 text-left font-medium">시나리오</th>
              <th className="px-3 py-2 text-left font-medium">상품 유형</th>
              <th className="px-3 py-2 text-right font-medium">원금</th>
              <th className="px-3 py-2 text-right font-medium">예상액</th>
              <th className="px-3 py-2 text-right font-medium">목표 달성률</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => (
              <tr
                key={s.id ?? i}
                className={`border-t border-slate-100 ${i === 0 ? "bg-brand-50/40" : ""}`}
              >
                <td className="px-3 py-2 font-medium text-slate-800">
                  {i === 0 && (
                    <span className="inline-block mr-1.5 text-[10px] font-bold text-brand-700 bg-brand-100 rounded px-1.5 py-0.5">
                      추천
                    </span>
                  )}
                  {s.title}
                </td>
                <td className="px-3 py-2 text-slate-600">{s.productType}</td>
                <td className="px-3 py-2 text-right text-slate-700">{won(s.principal)}</td>
                <td className="px-3 py-2 text-right text-slate-700">{won(s.expectedAmount)}</td>
                <td className="px-3 py-2 text-right text-slate-700">
                  {s.goalRate == null ? "-" : `${s.goalRate.toFixed(1)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
