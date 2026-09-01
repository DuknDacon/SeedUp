"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MessageCircle, Sparkles, Trash2 } from "lucide-react";
import {
  deleteRoadmapHistoryEntry,
  loadRoadmapHistory,
  type RoadmapHistoryEntry,
} from "@/lib/roadmapHistory";
import { saveProfile, setActiveThreadId } from "@/lib/profileStorage";

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

function formatWon(value?: number | null): string | null {
  if (value == null) return null;
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function profileSummaryLine(entry: RoadmapHistoryEntry): string {
  const { age, region, monthlyBudget, targetAmount } = entry.profileSummary;
  const parts = [
    age != null ? `${age}세` : null,
    region || null,
    monthlyBudget != null ? `월 ${formatWon(monthlyBudget)}` : null,
    targetAmount != null ? `목표 ${formatWon(targetAmount)}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

export default function MyRoadmapPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<RoadmapHistoryEntry[] | undefined>(undefined);

  useEffect(() => {
    setEntries(loadRoadmapHistory());
  }, []);

  function resumeEntry(entry: RoadmapHistoryEntry) {
    saveProfile(entry.profile);
    setActiveThreadId(entry.threadId);
    // ?resume=1 — "이전에 입력한 조건이 있어요" 픽커를 또 거치지 않고 바로
    // 채팅 화면으로 이어간다(이 조건으로 상담할 거라는 의도가 이미 명확하므로).
    router.push("/chat?resume=1");
  }

  function removeEntry(entry: RoadmapHistoryEntry) {
    if (!window.confirm("이 상담 이력을 삭제할까요? 되돌릴 수 없어요.")) return;
    deleteRoadmapHistoryEntry(entry.threadId);
    setEntries((cur) => cur?.filter((e) => e.threadId !== entry.threadId));
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-2 break-keep">
        🌳 내 로드맵
      </h1>
      <p className="text-sm text-slate-500 mb-6 break-keep">
        이 브라우저에서 만든 상담 이력이에요. 로그인 없이 이 기기에만
        저장되고, 브라우저 데이터를 지우면 함께 사라져요.
      </p>

      {entries === undefined ? (
        <div className="h-40 rounded-xl border bg-white animate-pulse" />
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <span className="w-12 h-12 mx-auto grid place-items-center bg-brand-50 text-brand-500 rounded-full mb-4">
            <Sparkles size={22} />
          </span>
          <h2 className="text-sm font-semibold text-slate-900 mb-1">
            아직 만든 로드맵이 없어요
          </h2>
          <p className="text-xs text-slate-500 mb-6">
            AI 상담을 시작하면 여기에 이력이 남아요.
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
        <div className="space-y-3">
          {entries.map((entry) => (
            <div
              key={entry.threadId}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <div className="flex items-center justify-between gap-3 mb-1">
                <h2 className="text-base font-bold text-slate-900 break-keep">
                  {entry.nickname || `${entry.title} 추천`}
                </h2>
                {entry.goalRate != null && (
                  <span
                    className={`flex-shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      entry.goalRate >= 100
                        ? "bg-sprout-50 text-sprout-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    달성률 {entry.goalRate.toFixed(0)}%
                  </span>
                )}
              </div>
              {entry.nickname && (
                <p className="text-xs text-slate-500 mb-1 break-keep">{entry.title} 추천</p>
              )}
              <p className="text-xs text-slate-500 mb-3 break-keep">
                {profileSummaryLine(entry)}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {formatDate(entry.generatedAt)}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => removeEntry(entry)}
                    title="이 상담 이력 삭제"
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                  >
                    <Trash2 size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => resumeEntry(entry)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 transition"
                  >
                    <MessageCircle size={13} />
                    이어서 상담하기
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
