/**
 * 챗 API 클라이언트 (LangGraph thread 기반).
 *
 * BenefitUp-Agent 의 그래프는 thread_id 로 세션 유지. 프론트는 uuid 발급 후 계속 재사용.
 * 응답은 reply 문자열 하나가 아니라 ChatBlock[] — 텍스트/구조화 결과/제안 질문이
 * 한 메시지 안에 섞여서 올 수 있다 (types/api.ts §챗 참고).
 */
import type { ChatBlock, ChatRequest, ChatResponse } from "@/types/api";
import { MOCK_POLICIES } from "./mockData";

const API_MODE = process.env.NEXT_PUBLIC_API_MODE ?? "mock";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8010";

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
    blocks: mockBlocksFor(req.message, !!req.profile),
  };
}

function mockBlocksFor(message: string, hasProfile: boolean): ChatBlock[] {
  const intro: ChatBlock[] = hasProfile
    ? [{ type: "text", content: "프로필을 참고해서 답변드릴게요." }]
    : [];

  // "왜 이렇게 추천했는지" 되묻는 경우 — 근거만 텍스트로 설명, 결과 재표시 없음
  if (message.includes("왜") || message.includes("이유")) {
    return [
      ...intro,
      {
        type: "text",
        content:
          "매칭된 정책은 크게 세 가지 기준으로 골랐어요:\n" +
          "1) 나이·거주지·고용형태가 지원 대상 조건에 맞고,\n" +
          "2) 관심 목표(예: 창업/취업)와 카테고리가 겹치며,\n" +
          "3) 접수 기간이 열려 있는 정책입니다.",
      },
      {
        type: "suggested_replies",
        suggestions: ["전세자금 대출도 보여줘", "청년정책만 다시 보여줘"],
      },
    ];
  }

  // 전세/주거 관련 — SQL 결과를 policy_results 블록(정해진 스키마)으로 반환
  if (message.includes("전세") || message.includes("주거")) {
    const items = MOCK_POLICIES.filter(
      (p) => p.source === "jeonse_loan" || p.categoryMajor === "주거",
    );
    return [
      ...intro,
      {
        type: "text",
        content: "주거·전세 관련해서 DB를 조회했어요. 아래 조건을 확인해 보세요.",
      },
      { type: "policy_results", items, query: message },
      {
        type: "sources",
        items: [{ title: "금감원 전세자금대출 API" }, { title: "서민금융진흥원 대출상품한눈에" }],
      },
      {
        type: "suggested_replies",
        suggestions: ["이 중에 금리가 제일 낮은 건?", "청년정책도 같이 보여줘"],
      },
    ];
  }

  // 은행별 금리 비교처럼 Policy 타입으로 정규화하기 애매한 임의 조회 — sql_table 블록 예시
  if (message.includes("금리") && message.includes("비교")) {
    return [
      ...intro,
      { type: "text", content: "은행별 전세대출 최저금리를 조회했어요." },
      {
        type: "sql_table",
        tables: ["jeonse_loan_products", "jeonse_loan_rates"],
        columns: ["kor_co_nm", "fin_prdt_nm", "lend_rate_min"],
        rows: [
          { kor_co_nm: "우리은행", fin_prdt_nm: "우리전세론(주택금융보증)", lend_rate_min: 3.76 },
          { kor_co_nm: "국민은행", fin_prdt_nm: "KB전세자금대출", lend_rate_min: 3.98 },
        ],
        rowCount: 2,
      },
      { type: "suggested_replies", suggestions: ["우리은행 상품 자세히 보여줘"] },
    ];
  }

  // 청년/창업/취업 등 일반 정책 질의 — youth_policy 위주로 policy_results
  if (
    message.includes("청년") ||
    message.includes("창업") ||
    message.includes("취업") ||
    message.includes("정책")
  ) {
    const items = MOCK_POLICIES.filter((p) => p.source === "youth_policy");
    return [
      ...intro,
      { type: "text", content: "조건에 맞는 청년정책을 DB에서 찾았어요." },
      { type: "policy_results", items, query: message },
      {
        type: "suggested_replies",
        suggestions: [
          "왜 이 정책들을 추천했어?",
          "자산관리 로드맵도 같이 짜줘",
        ],
      },
    ];
  }

  // 로드맵(기능②)으로 화제 전환 — 아직 담당자 개발 중이라 placeholder 블록만
  if (message.includes("로드맵") || message.includes("자산관리") || message.includes("시드머니")) {
    return [
      ...intro,
      { type: "text", content: "자산관리 로드맵 쪽으로 넘어가 볼게요." },
      { type: "roadmap_plan", plan: {} },
    ];
  }

  return [
    ...intro,
    {
      type: "text",
      content:
        "질문 잘 받았어요. (지금은 mock 응답이라 실제 판단은 안 됩니다.) " +
        "실제 API가 붙으면 BenefitUp-Agent 의 LangGraph 가 RAG + SQL 서브에이전트로 답변하고, " +
        "결과는 이 대화 안에 policy_results 블록으로 그대로 표시됩니다.",
    },
    {
      type: "suggested_replies",
      suggestions: ["청년 창업 지원 정책 알려줘", "전세자금 대출 조건이 궁금해요"],
    },
  ];
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
