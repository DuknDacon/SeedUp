"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Menu, MessageCircle, TrendingUp, X } from "lucide-react";

const NAV_LINKS = [
  { href: "/glossary", label: "용어사전", Icon: BookOpen },
  { href: "/my-roadmap", label: "내 로드맵", Icon: TrendingUp },
];

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="border-b bg-white sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link
          href="/"
          className="text-lg font-bold text-brand-700"
          onClick={() => setMobileOpen(false)}
        >
          🌱 SeedUp
        </Link>

        {/* 데스크톱 네비 */}
        <nav className="hidden md:flex items-center gap-4">
          {NAV_LINKS.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-brand-700"
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}
          <Link
            href="/chat"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800"
          >
            <MessageCircle size={15} />
            AI 상담
          </Link>
        </nav>

        {/* 모바일: 햄버거 */}
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="md:hidden w-9 h-9 grid place-items-center rounded-md border border-slate-200 text-slate-600"
          aria-label="메뉴 열기"
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 px-4 py-3 flex flex-col gap-3">
          {NAV_LINKS.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600"
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}
          <Link
            href="/chat"
            onClick={() => setMobileOpen(false)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700"
          >
            <MessageCircle size={15} />
            AI 상담
          </Link>
        </div>
      )}
    </header>
  );
}
