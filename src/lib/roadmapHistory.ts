/**
 * "내 로드맵" — 브라우저에 남는 개별 상담 이력.
 *
 * 로그인·서버 영구저장 없다는 원칙(IDEA.md)을 지키며, 상담마다 발급되는
 * threadId를 키로 이력을 쌓는다. 서버(Roadmap-Agent) 쪽 대화 체크포인트는
 * 30분 미활동 시 자동 삭제되지만, 이 이력은 그것과 별개로 이 브라우저의
 * localStorage에만 있고 사용자가 직접 지우기 전까진 만료되지 않는다.
 */
import type { UserProfile } from "@/types/api";

const KEY = "seedup:roadmapHistory";
const MAX_ENTRIES = 20;

export type RoadmapHistoryEntry = {
  threadId: string;
  nickname?: string;
  title: string;
  goalRate: number | null;
  generatedAt: string;
  profileSummary: {
    age?: number | null;
    region?: string | null;
    monthlyBudget?: number | null;
    targetAmount?: number | null;
    targetDate?: string | null;
  };
  /** "이어서 상담하기" 시 그대로 복원할 전체 프로필. */
  profile: UserProfile;
};

export function loadRoadmapHistory(): RoadmapHistoryEntry[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RoadmapHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function saveAll(entries: RoadmapHistoryEntry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}

/** threadId 기준으로 있으면 갱신, 없으면 맨 앞(최신)에 추가. */
export function upsertRoadmapHistoryEntry(entry: RoadmapHistoryEntry): void {
  const current = loadRoadmapHistory();
  const withoutExisting = current.filter((e) => e.threadId !== entry.threadId);
  saveAll([entry, ...withoutExisting]);
}

export function deleteRoadmapHistoryEntry(threadId: string): void {
  saveAll(loadRoadmapHistory().filter((e) => e.threadId !== threadId));
}

export function clearRoadmapHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
