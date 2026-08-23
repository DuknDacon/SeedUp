import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/lib/queryClient";
import Link from "next/link";

export const metadata: Metadata = {
  title: "SeedUp — 사회초년생 시드머니 빌드업 AI 비서",
  description: "정책 금융 매칭 + 자산관리 로드맵",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <QueryProvider>
          <div className="min-h-screen">
            <header className="border-b bg-white">
              <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
                <Link href="/" className="text-lg font-bold text-brand-700">
                  🌱 SeedUp
                </Link>
                <nav className="flex gap-4 text-sm text-slate-600">
                  <Link href="/onboarding" className="hover:text-brand-700">
                    프로필
                  </Link>
                  <Link href="/chat" className="hover:text-brand-700">
                    AI 상담
                  </Link>
                </nav>
              </div>
            </header>
            <main>{children}</main>
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}
