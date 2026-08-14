/**
 * 정책 매칭 API 클라이언트.
 *
 * 현재는 mock 모드. 나중에 BenefitUp-Agent 에 FastAPI 래퍼가 붙으면
 * NEXT_PUBLIC_API_MODE=live 로 스위치하고 아래 fetch 블록만 활성화하면 됨.
 * 컴포넌트/훅은 이 파일의 함수 시그니처만 알면 되므로 손대지 않는다.
 */
import type {
  Policy,
  PolicyDetailResponse,
  PolicyMatchRequest,
  PolicyMatchResponse,
  UserProfile,
} from "@/types/api";
import { MOCK_POLICIES } from "./mockData";

const API_MODE = process.env.NEXT_PUBLIC_API_MODE ?? "mock"; // "mock" | "live"
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

// ============================================================
// 프로필 기반 정책 매칭
// ============================================================
export async function matchPolicies(
  req: PolicyMatchRequest,
): Promise<PolicyMatchResponse> {
  if (API_MODE === "live") {
    const res = await fetch(`${API_BASE}/api/policy/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`match failed: ${res.status}`);
    return res.json();
  }

  // ── mock 경로 ──
  await sleep(600); // 로딩 흉내
  const scored = MOCK_POLICIES.map((p) => ({
    ...p,
    matchScore: recomputeScore(p, req.profile),
  }))
    .filter((p) => matchesHardFilter(p, req.profile))
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, req.limit ?? 20);

  return {
    matchedAt: new Date().toISOString(),
    policies: scored,
  };
}

// ============================================================
// 정책 상세 조회
// ============================================================
export async function getPolicy(id: string): Promise<PolicyDetailResponse> {
  if (API_MODE === "live") {
    const res = await fetch(`${API_BASE}/api/policy/${id}`);
    if (!res.ok) throw new Error(`getPolicy failed: ${res.status}`);
    return res.json();
  }

  await sleep(200);
  const policy = MOCK_POLICIES.find((p) => p.id === id);
  if (!policy) throw new Error(`policy not found: ${id}`);
  return { policy };
}

// ============================================================
// 내부 헬퍼 — mock 매칭 로직 (에이전트 대체용 초라한 규칙 기반)
// ============================================================

/** 하드 필터: 나이·소득 상한 넘으면 제외 */
function matchesHardFilter(p: Policy, profile: UserProfile): boolean {
  if (p.ageRange.min != null && profile.age < p.ageRange.min) return false;
  if (p.ageRange.max != null && profile.age > p.ageRange.max) return false;
  if (
    p.annualIncomeMaxKrw != null &&
    profile.annualIncomeKrw != null &&
    profile.annualIncomeKrw > p.annualIncomeMaxKrw
  ) {
    return false;
  }
  return true;
}

/** mock 스코어 재계산. 실제 서비스에서는 에이전트 LLM이 하는 일. */
function recomputeScore(p: Policy, profile: UserProfile): number {
  let score = p.matchScore ?? 50;

  // 고용형태 매칭
  if (p.employmentTypes.length > 0) {
    score += p.employmentTypes.includes(profile.employmentType) ? 10 : -15;
  }

  // 관심사 매칭
  if (profile.interests.some((i) => p.categoryMajor?.includes(i))) {
    score += 8;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
