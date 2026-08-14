/**
 * 챗 API 클라이언트 (LangGraph thread 기반).
 *
 * BenefitUp-Agent 의 그래프는 thread_id 로 세션 유지. 프론트는 uuid 발급 후 계속 재사용.
 */
import type { ChatRequest, ChatResponse } from "@/types/api";

const API_MODE = process.env.NEXT_PUBLIC_API_MODE ?? "mock";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export async function sendChat(req: ChatRequest): Promise<ChatResponse> {
  if (API_MODE === "live") {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`chat failed: ${res.status}`);
    return res.json();
  }

  // ── mock 경로 ──
  await sleep(900);
  return {
    threadId: req.threadId,
    reply: mockReplyFor(req.message, !!req.profile),
    sources: [
      { title: "2026년 소상공인 정책자금 융자계획 공고 (PDF)" },
      { title: "온통청년 정책 DB" },
    ],
  };
}

function mockReplyFor(message: string, hasProfile: boolean): string {
  const intro = hasProfile
    ? "프로필을 참고해서 답변드릴게요.\n\n"
    : "";
  if (message.includes("왜") || message.includes("이유")) {
    return (
      intro +
      "매칭된 정책은 크게 세 가지 기준으로 골랐어요:\n" +
      "1) 나이·거주지·고용형태가 지원 대상 조건에 맞고,\n" +
      "2) 관심 목표(예: 창업/취업)와 카테고리가 겹치며,\n" +
      "3) 접수 기간이 열려 있는 정책입니다.\n\n" +
      "각 카드의 'match reason'이 개별 근거예요."
    );
  }
  if (message.includes("전세") || message.includes("주거")) {
    return (
      intro +
      "주거·전세 관련해서는 '저소득주민 융자사업(주택매입 및 전세임대자금 지원)' 같은 지자체 무이자 융자가 눈에 띕니다. " +
      "소득/거주 요건 확인이 필요하니 상세 카드를 열어보세요."
    );
  }
  return (
    intro +
    "질문 잘 받았어요. (지금은 mock 응답이라 실제 정책 판단은 안 됩니다.) " +
    "실제 API가 붙으면 BenefitUp-Agent 의 LangGraph 가 RAG + SQL 서브에이전트로 답변합니다."
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
