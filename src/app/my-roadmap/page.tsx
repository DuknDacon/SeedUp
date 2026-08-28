"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, Sparkles, TrendingUp } from "lucide-react";
import {
  loadLastRoadmapSummary,
  type LastRoadmapSummary,
} from "@/lib/lastRoadmapSummary";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function MyRoadmapPage() {
  const [summary, setSummary] = useState<LastRoadmapSummary | null | undefined>(
    undefined,
  );

  useEffect(() => {
    setSummary(loadLastRoadmapSummary());
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-2 break-keep">
        🌳 내 로드맵
      </h1>
      <p className="text-sm text-slate-500 mb-6 break-keep">
        이 브라우저에서 가장 최근에 만든 자산관리 로드맵 요약이에요. 로그인
        없이 이 기기에만 저장돼요.
      </p>

      {summary === undefined ? (
        <div className="h-40 rounded-xl border bg-white animate-pulse" />
      ) : summary === null ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <span className="w-12 h-12 mx-auto grid place-items-center bg-brand-50 text-brand-500 rounded-full mb-4">
            <Sparkles size={22} />
          </span>
          <h2 className="text-sm font-semibold text-slate-900 mb-1">
            아직 만든 로드맵이 없어요
          </h2>
          <p className="text-xs text-slate-500 mb-6">
            AI 상담을 시작하면 여기에 요약이 남아요.
          </p>
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition"
          >
            <MessageCircle size={15} />
            AI 상담 시작하기
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-sprout-100 bg-sprout-50/60 p-6">
          <div className="flex items-center gap-2 text-xs font-semibold text-sprout-700 mb-3">
            <TrendingUp size={14} />
            최근 상담 결과
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2 break-keep">
            {summary.title}
          </h2>
          {summary.goalRate != null && (
            <p className="text-sm text-slate-700 mb-1">
              목표 달성률 <b>{summary.goalRate.toFixed(1)}%</b>
            </p>
          )}
          <p className="text-xs text-slate-500 mb-6">
            {formatDate(summary.generatedAt)} 생성
          </p>
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition"
          >
            <MessageCircle size={15} />
            이어서 상담하기
          </Link>
        </div>
      )}
    </div>
  );
}
