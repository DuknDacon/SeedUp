/**
 * "지난 상담 요약" — 로그인 없는 서비스라 서버에 남기지 않고 이 브라우저에만
 * 마지막 로드맵 결과 요약(추천 상품명·목표 달성률)을 저장해, picker 화면에서
 * "지난번엔 이런 결과였어요"를 바로 보여준다.
 */
const KEY = "seedup:lastRoadmapSummary";

export type LastRoadmapSummary = {
  title: string;
  goalRate: number | null;
  generatedAt: string;
};

export function saveLastRoadmapSummary(summary: LastRoadmapSummary): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(summary));
}

export function loadLastRoadmapSummary(): LastRoadmapSummary | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LastRoadmapSummary;
  } catch {
    return null;
  }
}

export function clearLastRoadmapSummary(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
