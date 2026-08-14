/**
 * 정책 카드 하나.
 * 리스트/상세에서 재사용. compact 프롭으로 리스트 뷰 최적화.
 */
import Link from "next/link";
import type { Policy } from "@/types/api";
import {
  formatAgeRange,
  formatKrw,
  formatRateRange,
} from "@/lib/format";

const SOURCE_META: Record<
  Policy["source"],
  { label: string; emoji: string; tone: string }
> = {
  youth_policy: {
    label: "청년정책",
    emoji: "🎯",
    tone: "bg-emerald-50 text-emerald-700",
  },
  seomin_loan: {
    label: "정책대출",
    emoji: "💰",
    tone: "bg-amber-50 text-amber-700",
  },
  jeonse_loan: {
    label: "전세대출",
    emoji: "🏠",
    tone: "bg-sky-50 text-sky-700",
  },
  welfare_service: {
    label: "복지서비스",
    emoji: "🤝",
    tone: "bg-violet-50 text-violet-700",
  },
};

export function PolicyCard({ policy }: { policy: Policy }) {
  const meta = SOURCE_META[policy.source];

  return (
    <Link
      href={`/policy/${policy.id}`}
      className="block rounded-xl border bg-white p-4 shadow-sm hover:shadow-md hover:border-brand-500 transition"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${meta.tone}`}
            >
              {meta.emoji} {meta.label}
            </span>
            {policy.categoryMajor && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {policy.categoryMajor}
              </span>
            )}
            {policy.isAlwaysOpen && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                상시 접수
              </span>
            )}
          </div>
          <h3 className="font-semibold text-slate-900 leading-snug">
            {policy.title}
          </h3>
          {policy.summary && (
            <p className="text-sm text-slate-600 mt-1 line-clamp-2">
              {policy.summary}
            </p>
          )}
        </div>
        <MatchBadge score={policy.matchScore} />
      </div>

      {/* 핵심 조건 */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        <span>👤 {formatAgeRange(policy.ageRange.min, policy.ageRange.max)}</span>
        {policy.regionNames.length > 0 && (
          <span>📍 {policy.regionNames.join(", ")}</span>
        )}
        {policy.employmentTypes.length > 0 && (
          <span>💼 {policy.employmentTypes.join(", ")}</span>
        )}
        {policy.itemType === "loan" && (
          <>
            <span>💵 한도 {formatKrw(policy.loanLimitKrw)}</span>
            <span>
              📈 금리{" "}
              {formatRateRange(policy.interestRateMin, policy.interestRateMax)}
            </span>
          </>
        )}
        {policy.applicationEndDate && !policy.isAlwaysOpen && (
          <span>📅 ~{policy.applicationEndDate}</span>
        )}
      </div>

      {/* 매칭 근거 */}
      <div className="mt-3 p-2 bg-brand-50 rounded text-sm text-brand-700">
        ✨ {policy.matchReason}
      </div>
    </Link>
  );
}

function MatchBadge({ score }: { score: number }) {
  const tone =
    score >= 80
      ? "bg-green-100 text-green-700"
      : score >= 60
        ? "bg-blue-100 text-blue-700"
        : "bg-slate-100 text-slate-600";
  return (
    <div
      className={`shrink-0 text-center rounded-lg px-3 py-1 ${tone}`}
      title="매칭 적합도 (0~100)"
    >
      <div className="text-lg font-bold leading-none">{score}</div>
      <div className="text-[10px] mt-0.5">적합도</div>
    </div>
  );
}
