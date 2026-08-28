/**
 * ChatBlock[] → 실제 UI 컴포넌트 매핑.
 *
 * 기능①/기능②가 같은 ChatBlock 스키마로 응답하는 한, 이 렌더러 하나로
 * 두 기능의 결과를 한 대화 화면 안에서 자연스럽게 이어 보여줄 수 있다.
 * 새 블록 타입이 생기면 여기 case 하나만 추가하면 됨.
 */
import type { ChatBlock, ProfileAskField, UserProfile } from "@/types/api";
import { PolicyResultBlock } from "@/features/policy/chat/PolicyResultBlock";
import { LoanDetailBlock } from "@/features/policy/chat/LoanDetailBlock";
import { SqlResultTable } from "@/features/policy/chat/SqlResultTable";
import { RecommendationsBlockView } from "@/features/policy/chat/RecommendationsBlockView";
import { RoadmapPlanBlock } from "@/features/roadmap/RoadmapPlanBlock";
import { ProfileAskForm } from "./ProfileAskForm";
import { FormattedText } from "./FormattedText";

export function ChatBlockRenderer({
  block,
  onSuggestionClick,
  onProfileAsk,
}: {
  block: ChatBlock;
  /** suggested_replies 블록의 chip 클릭 시 그 문장을 그대로 다음 turn 으로 전송 */
  onSuggestionClick?: (text: string) => void;
  /** profile_ask 블록의 미니 폼 제출 콜백. 부모(ChatWindow)가 profile 병합 + 다음 turn 발송 담당. */
  onProfileAsk?: (patch: Partial<UserProfile>, fields: ProfileAskField[]) => void;
}) {
  switch (block.type) {
    case "text":
      return <FormattedText text={block.content} />;

    case "policy_results":
      return <PolicyResultBlock items={block.items} query={block.query} />;

    case "loan_detail":
      return <LoanDetailBlock item={block.item} rateOptions={block.rateOptions} />;

    case "sql_table":
      return (
        <SqlResultTable
          tables={block.tables}
          columns={block.columns}
          rows={block.rows}
          rowCount={block.rowCount}
        />
      );

    case "recommendations":
      return <RecommendationsBlockView items={block.items} />;

    case "roadmap_plan":
      return <RoadmapPlanBlock plan={block.plan} />;

    case "profile_ask":
      return (
        <ProfileAskForm
          context={block.context}
          fields={block.fields}
          onSubmit={onProfileAsk}
        />
      );

    case "sources":
      if (block.items.length === 0) return null;
      return (
        <div className="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-500">
          📄 참고: {block.items.map((s) => s.title).join(" · ")}
        </div>
      );

    case "suggested_replies":
      if (block.suggestions.length === 0) return null;
      return (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {block.suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSuggestionClick?.(s)}
              className="text-xs px-2.5 py-1 rounded-full border border-brand-300 text-brand-700 bg-white hover:bg-brand-50 transition"
            >
              {s}
            </button>
          ))}
        </div>
      );

    default:
      return null;
  }
}
