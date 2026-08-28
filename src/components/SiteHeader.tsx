"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, MessageCircle, Moon, Sun, X } from "lucide-react";
import { applyTheme, resolveInitialTheme, type Theme } from "@/lib/theme";

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(resolveInitialTheme());
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  return (
    <header className="border-b bg-white dark:bg-slate-900 dark:border-slate-800 sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link
          href="/"
          className="text-lg font-bold text-brand-700 dark:text-brand-400"
          onClick={() => setMobileOpen(false)}
        >
          🌱 SeedUp
        </Link>

        {/* 데스크톱 네비 */}
        <nav className="hidden md:flex items-center gap-4">
          <Link
            href="/chat"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 dark:text-brand-400 hover:text-brand-800"
          >
            <MessageCircle size={15} />
            AI 상담
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="다크모드 전환"
            className="w-9 h-9 grid place-items-center rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </nav>

        {/* 모바일: 햄버거 */}
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="md:hidden w-9 h-9 grid place-items-center rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
          aria-label="메뉴 열기"
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
          <Link
            href="/chat"
            onClick={() => setMobileOpen(false)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 dark:text-brand-400"
          >
            <MessageCircle size={15} />
            AI 상담
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="다크모드 전환"
            className="w-9 h-9 grid place-items-center rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      )}
    </header>
  );
}
