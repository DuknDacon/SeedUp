/**
 * 정책 자격 요약을 카드로 보여주는 블록.
 *
 * 예전엔 이 내용을 chat_reply 문장 하나에 조건을 세미콜론으로 다 이어붙여
 * 보여줬는데, 정책이 여러 개고 조건이 많으면(실제로 9개까지도 있음) 문장이
 * 도배돼 가독성이 크게 떨어진다는 실사용자 피드백으로 카드로 바꿨다.
 * 상세 페이지 이동 클릭 이벤트는 제거됨 — 순수 요약 표시 용도.
 * 하단 전체 너비 섹션에 자리 잡은 뒤로는(ChatWindow 참고) 세로로만 쌓지
 * 않고 폭이 넓으면 카드가 나란히 배치되도록 grid로 바꿨다.
 */
import { CheckCircle2, CircleHelp, SearchX } from "lucide-react";
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
  // 라우터가 이 블록을 보낸다는 것 자체가 "이번 turn에 정책 자격을 실제로
  // 판정했다"는 뜻이다(router.py 참고) — cards가 비어 있으면 아직 조건을
  // 안 넣은 게 아니라 판정 결과가 진짜 0건인 것이므로, 그냥 안 그리지
  // 않고 명확히 안내한다. 안 그러면 조건을 다 입력한 사용자에게도 상위
  // ChatWindow의 기본 문구("조건을 입력하면...")가 그대로 남아 아직
  // 아무것도 안 한 것처럼 보인다(실사용자 피드백).
  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center text-center text-sm text-slate-400 py-8">
        <span className="w-11 h-11 grid place-items-center rounded-full bg-slate-100 text-slate-400 mb-3">
          <SearchX size={20} />
        </span>
        지금 입력한 조건으로는 신청 가능한 정책 상품이 없습니다.
        <br />
        조건을 바꾸거나, 탈락 사유와 모집상태를 공식 공고에서 다시 확인해 주세요.
      </div>
    );
  }

  return (
    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {cards.map((card) => (
        <div
          key={card.policyId}
          className="rounded-lg border bg-white overflow-hidden"
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
        </div>
      ))}
    </div>
  );
}
