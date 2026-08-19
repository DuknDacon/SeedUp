/**
 * 챗 메시지 안에 임베드되는 정책/대출 조회 결과 블록.
 *
 * PolicyCard 처럼 큰 카드를 나열하는 게 아니라, 대화 흐름을 끊지 않고
 * 훑어볼 수 있는 컴팩트한 "정해진 스키마" 리스트. 항목을 누르면 /policy/[id] 상세로 이동.
 */
import Link from "next/link";
import type { Policy } from "@/types/api";
import { formatAgeRange, formatKrw, formatRateRange } from "@/lib/format";

const SOURCE_META: Record<Policy["source"], { label: string; emoji: string }> = {
  youth_policy: { label: "청년정책", emoji: "🎯" },
  seomin_loan: { label: "정책대출", emoji: "💰" },
  jeonse_loan: { label: "전세대출", emoji: "🏠" },
  welfare_service: { label: "복지서비스", emoji: "🤝" },
};

export function PolicyResultBlock({
  items,
  query,
}: {
  items: Policy[];
  query?: string;
}) {
  if (items.length === 0) {
    return (
      <div className="mt-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        조건에 맞는 결과를 찾지 못했어요.
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg border bg-white overflow-hidden max-w-full">
      <div className="px-3 py-1.5 bg-slate-50 border-b text-xs font-medium text-slate-500">
        🔎 조회 결과 {items.length}건{query ? ` · "${query}"` : ""}
      </div>
      <ul className="divide-y">
        {items.map((p) => (
          <li key={p.id}>
            <Link
              href={`/policy/${p.id}`}
              className="flex items-start gap-2 px-3 py-2 hover:bg-brand-50 transition"
            >
              <span className="text-base leading-none mt-0.5 shrink-0">
                {SOURCE_META[p.source].emoji}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-medium text-slate-900">
                    {p.title}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 shrink-0">
                    {SOURCE_META[p.source].label}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                  <span>👤 {formatAgeRange(p.ageRange.min, p.ageRange.max)}</span>
                  {p.itemType === "loan" && (
                    <>
                      <span>💵 {formatKrw(p.loanLimitKrw)}</span>
                      <span>
                        📈 {formatRateRange(p.interestRateMin, p.interestRateMax)}
                      </span>
                    </>
                  )}
                  {p.regionNames.length > 0 && p.regionNames[0] !== "전국" && (
                    <span>📍 {p.regionNames.join(", ")}</span>
                  )}
                </div>
              </div>
              <span className="shrink-0 text-xs font-semibold text-brand-700 self-center">
                {p.matchScore}점 ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
