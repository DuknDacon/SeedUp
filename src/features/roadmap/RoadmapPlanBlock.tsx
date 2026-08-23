/**
 * 기능②(자산관리 & 시드머니 로드맵) 결과를 챗 안에 렌더링하는 블록.
 *
 * TODO(로드맵 담당자):
 *   1. types/api.ts 의 `RoadmapPlanPayload`(현재 placeholder) 를 실제 RoadmapPlan 타입으로 교체
 *      (ChatBlock 의 { type: "roadmap_plan"; plan: RoadmapPlanPayload } 도 같이 갱신)
 *   2. 이 컴포넌트만 실제 UI로 구현하면 됨 — 챗 렌더러(components/chat/ChatBlockRenderer.tsx)는
 *      이미 이 컴포넌트에 연결돼 있어서 다른 곳은 손댈 필요 없음
 *   3. README.md 의 관례대로, 이 폴더 컴포넌트는 features/policy/* 에 의존하지 말 것
 */
import type { RoadmapPlanPayload } from "@/types/api";

export function RoadmapPlanBlock({ plan }: { plan: RoadmapPlanPayload }) {
  return (
    <div className="mt-2 rounded-lg border border-dashed border-brand-300 bg-brand-50 px-3 py-2 text-xs text-brand-700">
      🗺️ 자산관리 로드맵 기능은 아직 개발 중이에요. 완성되면 이 자리에 로드맵 결과가
      표시됩니다.
      {process.env.NODE_ENV === "development" &&
        Object.keys(plan).length > 0 && (
          <pre className="mt-1 text-[10px] text-slate-500 overflow-x-auto">
            {JSON.stringify(plan, null, 2)}
          </pre>
        )}
    </div>
  );
}
