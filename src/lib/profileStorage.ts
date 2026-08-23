/**
 * 유저 프로필 로컬 저장.
 *
 * 인증은 아직 없으니 localStorage 에 프로필과 threadId 를 임시 보관.
 * 로그인 붙는 순간 서버 저장으로 이관.
 */
import type { UserProfile } from "@/types/api";

const PROFILE_KEY = "seedup:profile";
const THREAD_KEY = "seedup:threadId";

export function saveProfile(p: UserProfile): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

export function loadProfile(): UserProfile | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export function clearProfile(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PROFILE_KEY);
}

/**
 * 부분 갱신. 라우터가 준 `profilePatch` 또는 사용자가 채운 slot-fill 답변을
 * 기존 프로필에 병합해 저장한다. 저장된 값이 없으면 patch 만 저장.
 * 반환: 병합된 최종 프로필 (또는 patch 가 비었으면 기존 값).
 */
export function mergeProfile(patch: Partial<UserProfile>): UserProfile | null {
  if (typeof window === "undefined") return null;
  if (!patch || Object.keys(patch).length === 0) return loadProfile();
  const current = loadProfile();
  // 기존 프로필이 있으면 병합, 없으면 patch 만으로 시드.
  // 정책 프로필 필수 필드(age/regionCode/employmentType/…)는 여전히 정책 온보딩
  // 에서만 채워지고, 여기 slot-fill 결과는 로드맵 필드 위주. 정책 호출 시점에
  // 필수 필드 부재는 라우터/BenefitUp-Agent 가 알아서 반려한다.
  const merged = { ...(current ?? {}), ...patch } as UserProfile;
  saveProfile(merged);
  return merged;
}

export function getOrCreateThreadId(): string {
  if (typeof window === "undefined") return "";
  const existing = localStorage.getItem(THREAD_KEY);
  if (existing) return existing;
  const fresh = crypto.randomUUID();
  localStorage.setItem(THREAD_KEY, fresh);
  return fresh;
}

export function resetThreadId(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(THREAD_KEY);
}
