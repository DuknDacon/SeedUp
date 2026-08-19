/**
 * 정책 상세 조회 API 클라이언트.
 *
 * 현재는 mock 모드. 나중에 BenefitUp-Agent 에 FastAPI 래퍼가 붙으면
 * NEXT_PUBLIC_API_MODE=live 로 스위치하고 아래 fetch 블록만 활성화하면 됨.
 *
 * ⚠️ 프로필 기반 원샷 매칭(matchPolicies)은 챗 통합(services/chatApi.ts 의
 * `policy_results` 블록)으로 대체되어 제거했다. 상세 조회(getPolicy)만 남는다 —
 * 챗 안의 정책 결과 항목을 클릭하면 `/policy/[id]` 에서 이 함수로 상세를 가져온다.
 */
import type { PolicyDetailResponse } from "@/types/api";
import { MOCK_POLICIES } from "./mockData";

const API_MODE = process.env.NEXT_PUBLIC_API_MODE ?? "mock"; // "mock" | "live"
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8010";

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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
