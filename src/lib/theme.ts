/**
 * 다크모드 토글 (Tailwind `darkMode: "class"` 기반).
 * 이번 패스에서는 새 홈페이지·헤더에만 다크 스타일을 적용 — 기존 /chat, /onboarding,
 * /policy/[id] 등은 globals.css 커스텀 클래스 기반이라 이번 범위에서 제외.
 */
const THEME_KEY = "seedup:theme";

export type Theme = "light" | "dark";

export function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(THEME_KEY);
  return raw === "dark" || raw === "light" ? raw : null;
}

export function resolveInitialTheme(): Theme {
  const stored = getStoredTheme();
  if (stored) return stored;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem(THEME_KEY, theme);
}

/** 하이드레이션 전 깜빡임(FOUC) 방지용 — layout.tsx <head>에 인라인 스크립트로 삽입. */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("${THEME_KEY}");
    var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;
