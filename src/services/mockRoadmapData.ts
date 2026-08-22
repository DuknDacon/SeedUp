/**
 * Mock 로드맵 응답 생성기.
 *
 * Roadmap-Agent FastAPI 백엔드(../Roadmap-Agent 컨테이너)가 로컬에 떠 있지 않아도
 * UI를 확인할 수 있도록 입력값 기반으로 그럴듯한 시나리오를 계산해 만든다.
 * 실제 서비스에서는 이 계산을 Roadmap-Agent의 오케스트레이터가 수행한다.
 * 진짜 API가 붙으면 `roadmapApi.ts`의 mock 분기만 지우면 됨.
 */
import type { AllocationItem, RoadmapRequest, RoadmapResponse, Scenario } from "@/types/api";

const ALLOCATION_META: Record<string, { label: string; color: string }> = {
  savings: { label: "예·적금", color: "#2775d7" },
  cash_equivalent: { label: "현금성 자산", color: "#82b3ef" },
  diversified_investment: { label: "분산투자", color: "#20a464" },
  unallocated_cash: { label: "미배분 금액", color: "#f3b73f" },
};

function monthsUntil(targetDate: string, today = new Date()): number {
  const [year, month] = targetDate.split("-").map(Number);
  const total = (year - today.getFullYear()) * 12 + (month - 1 - today.getMonth());
  return Math.max(1, total);
}

function buildAllocations(monthlyAmount: number, ratios: [string, number][]): AllocationItem[] {
  return ratios
    .filter(([, ratio]) => ratio > 0)
    .map(([key, ratio]) => ({
      label: ALLOCATION_META[key].label,
      color: ALLOCATION_META[key].color,
      amount: Math.round(monthlyAmount * ratio),
    }));
}

function buildScenario(params: {
  id: string;
  badge: string;
  title: string;
  productType: string;
  monthlyAmount: number;
  months: number;
  annualRate: number;
  allocationRatios: [string, number][];
  targetAmount: number | null;
  highlights: string[];
  warnings: string[];
  monthlyLimit: number | null;
}): Scenario {
  const { monthlyAmount, months, annualRate, targetAmount } = params;
  const principal = monthlyAmount * months;
  const expectedAmount = Math.round(principal * (1 + (annualRate * months) / 24));
  return {
    id: params.id,
    badge: params.badge,
    title: params.title,
    productType: params.productType,
    monthlyAmount,
    expectedAmount,
    principal,
    goalRate: targetAmount ? Math.round((expectedAmount / targetAmount) * 1000) / 10 : undefined,
    shortfall: targetAmount ? Math.max(0, targetAmount - expectedAmount) : undefined,
    allocations: buildAllocations(monthlyAmount, params.allocationRatios),
    highlights: params.highlights,
    warnings: params.warnings,
    evidence: [
      {
        title: "청년도약계좌 상품 안내 (금융위원회)",
        organization: "금융위원회",
        url: "https://www.fsc.go.kr",
      },
    ],
    monthlyLimit: params.monthlyLimit,
  };
}

export function buildMockRoadmapResponse(
  request: RoadmapRequest,
  question = "",
): RoadmapResponse {
  const months = monthsUntil(request.targetDate);
  const monthlyAmount = request.monthlyBudget;
  const isGrowth = request.riskLevel === "growth";
  const isStable = request.riskLevel === "stable";

  const recommended = buildScenario({
    id: "mock-recommended",
    badge: "AI 추천",
    title: isGrowth ? "정책상품 + 분산투자 혼합 플랜" : "청년도약계좌 중심 안전 플랜",
    productType: isGrowth ? "정책상품 + ETF" : "정책 저축상품",
    monthlyAmount,
    months,
    annualRate: isGrowth ? 0.06 : 0.045,
    allocationRatios: isGrowth
      ? [["savings", 0.5], ["diversified_investment", 0.4], ["unallocated_cash", 0.1]]
      : [["savings", 0.8], ["cash_equivalent", 0.15], ["unallocated_cash", 0.05]],
    targetAmount: request.targetAmount,
    highlights: [
      "정부 매칭지원금이 포함된 정책 저축상품을 우선 배치했어요.",
      "목표 시점까지 매달 동일한 금액을 투입하는 것으로 계산했어요.",
    ],
    warnings: ["실제 상품 조건(가입 기간·한도 등)은 가입 전 다시 확인해 주세요."],
    monthlyLimit: 700000,
  });

  const alternative = buildScenario({
    id: "mock-alternative",
    badge: "대안",
    title: isStable ? "정기적금 단독 플랜" : "예·적금 + 분산투자 균형 플랜",
    productType: isStable ? "정기적금" : "예·적금 + 투자",
    monthlyAmount,
    months,
    annualRate: isStable ? 0.035 : 0.05,
    allocationRatios: isStable
      ? [["savings", 1]]
      : [["savings", 0.6], ["diversified_investment", 0.3], ["unallocated_cash", 0.1]],
    targetAmount: request.targetAmount,
    highlights: ["원금 손실 위험을 낮추고 싶을 때 고려할 수 있는 대안이에요."],
    warnings: ["시장 상황에 따라 분산투자 구간의 실제 수익률은 달라질 수 있어요."],
    monthlyLimit: null,
  });

  return {
    recommended,
    alternative,
    summary: `월 ${monthlyAmount.toLocaleString("ko-KR")}원씩 ${months}개월 동안 모으는 두 가지 경로를 비교했어요. (mock 데이터)`,
    explanation: null,
    recommendedReason:
      "입력하신 조건 기준으로 정책 지원금 혜택이 큰 상품을 우선 배치했어요. (실제 서비스에서는 Roadmap-Agent가 RAG 근거와 함께 설명합니다.)",
    alternativeReason: "위험을 더 낮추고 싶은 경우를 대비한 대안 플랜이에요.",
    chatReply: question ? mockChatReply(question) : null,
    notice: "지금은 mock 데이터입니다. 실제 정책·상품 조건은 Roadmap-Agent 백엔드 연결 후 반영돼요.",
    generatedAt: new Date().toISOString(),
    conversationStatus: question ? "completed" : null,
    conversationIntent: null,
    requestPatch: null,
  };
}

function mockChatReply(question: string): string {
  if (question.includes("왜") || question.includes("이유")) {
    return "추천 플랜은 정부 매칭지원금이 있는 정책 저축상품을 우선 배치하고, 남은 금액을 목표 위험 성향에 맞춰 분산했어요. (mock 응답)";
  }
  if (question.includes("위험") || question.includes("줄여")) {
    return "위험을 낮추려면 분산투자 비중을 줄이고 예·적금 비중을 늘리는 게 안전해요. 대안 플랜을 참고해 주세요. (mock 응답)";
  }
  return "질문 잘 받았어요. (지금은 mock 응답이라 실제 재계산은 반영되지 않습니다.)";
}
