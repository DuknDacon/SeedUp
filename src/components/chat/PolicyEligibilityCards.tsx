/**
 * 정책 자격 요약을 카드로 보여주는 블록.
 *
 * 예전엔 이 내용을 chat_reply 문장 하나에 조건을 세미콜론으로 다 이어붙여
 * 보여줬는데, 정책이 여러 개고 조건이 많으면(실제로 9개까지도 있음) 문장이
 * 도배돼 가독성이 크게 떨어진다는 실사용자 피드백으로 카드로 바꿨다.
 */
import Link from "next/link";
import { CheckCircle2, CircleHelp } from "lucide-react";
import type { PolicyEligibilityCard } from "@/types/api";

const QUALIFICATION_STYLE: Record<string, string> = {
  "자격 확인": "bg-emerald-100 text-emerald-700",
  "추가정보 필요": "bg-amber-100 text-amber-700",
  "운영기관 확인 필요": "bg-amber-100 text-amber-700",
  "대상 아님": "bg-rose-100 text-rose-700",
};

function conditionIcon(condition: string) {
  // "N건 확인 필요"처럼 아직 안 끝난 조건만 물음표 아이콘, 나머지("충족")는 체크.
  if (condition.includes("확인 필요")) {
    return <CircleHelp size={13} className="text-amber-500 shrink-0 mt-0.5" />;
  }
  return <CheckCircle2 size={13} className="text-emerald-500 shrink-0 mt-0.5" />;
}

export function PolicyEligibilityCards({ cards }: { cards: PolicyEligibilityCard[] }) {
  if (cards.length === 0) return null;

  return (
    <div className="mt-2 space-y-2">
      {cards.map((card) => (
        <Link
          key={card.policyId}
          href={`/policy/${card.policyId}`}
          className="block rounded-lg border bg-white overflow-hidden hover:border-brand-300 hover:shadow-sm transition"
        >
          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 border-b">
            <span className="text-sm font-medium text-slate-900 truncate">{card.name}</span>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                {card.tier}
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  QUALIFICATION_STYLE[card.qualificationStatus] ?? "bg-slate-100 text-slate-500"
                }`}
              >
                {card.qualificationStatus}
              </span>
            </div>
          </div>
          <div className="px-3 py-2 text-[11px] text-slate-500">{card.availability}</div>
          <ul className="px-3 pb-2.5 space-y-1">
            {card.conditions.map((condition) => (
              <li key={condition} className="flex items-start gap-1.5 text-[12px] text-slate-700">
                {conditionIcon(condition)}
                <span>{condition}</span>
              </li>
            ))}
          </ul>
        </Link>
      ))}
    </div>
  );
}
