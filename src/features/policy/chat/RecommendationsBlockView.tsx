/**
 * "AI 추천" 카드 리스트.
 *
 * SqlResultTable 이 SELECT 원본 전체를 보여주는 개발/디버그용이라면, 이 블록은
 * LLM 이 최종 답변에서 실제로 언급한 row 만 뽑아 URL 을 붙여준 사용자용 카드다
 * (§BenefitUp-Agent/agent/recommender.py).
 *
 * url 이 null 인 항목(jeonse_loan_products/rates 처럼 URL 컬럼이 없는 테이블)은
 * 카드 자체는 표시하되 이동 버튼만 비활성 상태로 둔다 — UX 일관성 유지.
 */
import type { components } from "@/types/generated/backend.gen";

type RecommendationItem = components["schemas"]["RecommendationItem"];

// 테이블별 표시 라벨/이모지. 백엔드의 RECO_TABLE_META 와 짝을 이룬다.
const TABLE_META: Record<string, { label: string; emoji: string }> = {
  youth_policies:       { label: "청년정책",   emoji: "🎯" },
  sme_loan_products:    { label: "서민금융",   emoji: "💰" },
  welfare_services:     { label: "복지서비스", emoji: "🤝" },
  jeonse_loan_products: { label: "전세대출",   emoji: "🏠" },
  jeonse_loan_rates:    { label: "전세대출",   emoji: "🏠" },
};

function tableMeta(table: string) {
  return TABLE_META[table] ?? { label: table, emoji: "📌" };
}

export function RecommendationsBlockView({
  items,
}: {
  items: RecommendationItem[];
}) {
  if (items.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg border bg-white overflow-hidden max-w-full">
      <div className="px-3 py-1.5 bg-brand-50 border-b text-xs font-medium text-brand-700">
        ✨ AI 추천 {items.length}건
      </div>
      <ul className="divide-y">
        {items.map((it, i) => {
          const meta = tableMeta(it.table);
          const key = it.refKey ?? `${it.table}:${i}`;
          const hasUrl = !!it.url;
          return (
            <li key={key} className="flex items-start gap-2 px-3 py-2">
              <span className="text-base leading-none mt-0.5 shrink-0">
                {meta.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-medium text-slate-900">
                    {it.title}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 shrink-0">
                    {meta.label}
                  </span>
                </div>
                {it.subtitle && (
                  <div className="mt-0.5 text-[11px] text-slate-500 truncate">
                    {it.subtitle}
                  </div>
                )}
              </div>
              {hasUrl ? (
                <a
                  href={it.url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 self-center text-xs font-semibold text-brand-700 hover:text-brand-800 hover:underline"
                >
                  자세히 보기 ↗
                </a>
              ) : (
                <span
                  className="shrink-0 self-center text-xs font-semibold text-slate-300 cursor-not-allowed"
                  title="상세 페이지 링크가 제공되지 않는 상품이에요"
                >
                  링크 없음
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
