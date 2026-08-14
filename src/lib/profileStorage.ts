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
