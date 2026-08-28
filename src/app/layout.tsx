import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/lib/queryClient";
import { SiteHeader } from "@/components/SiteHeader";
import { ScrollToTopButton } from "@/components/ScrollToTopButton";

const TITLE = "SeedUp — 사회초년생 시드머니 빌드업 AI 비서";
const DESCRIPTION =
  "나이·소득·지역·목표만 알려주면 정책 금융 매칭과 자산관리 로드맵을 AI가 함께 만들어 드립니다.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
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
          <div className="min-h-screen bg-white">
            <SiteHeader />
            <main>{children}</main>
            <ScrollToTopButton />
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}
