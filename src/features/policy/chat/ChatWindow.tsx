/**
 * 챗 UI. thread_id 로 대화 상태를 이어감.
 * 첫 번째 메시지에만 profile 을 함께 보내서 에이전트가 컨텍스트로 활용하게 함.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { sendChat } from "@/services/chatApi";
import {
  getOrCreateThreadId,
  loadProfile,
  resetThreadId,
} from "@/lib/profileStorage";
import type { ChatSource, UserProfile } from "@/types/api";

type Msg = {
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
};

export function ChatWindow() {
  const [threadId, setThreadId] = useState<string>("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [firstTurnSent, setFirstTurnSent] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setThreadId(getOrCreateThreadId());
    setProfile(loadProfile());
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const chat = useMutation({
    mutationFn: sendChat,
    onSuccess: (res) => {
      setMessages((cur) => [
        ...cur,
        { role: "assistant", content: res.reply, sources: res.sources },
      ]);
    },
    onError: () => {
      setMessages((cur) => [
        ...cur,
        {
          role: "assistant",
          content: "일시적인 오류로 답변을 생성하지 못했어요. 잠시 후 다시 시도해 주세요.",
        },
      ]);
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || chat.isPending) return;

    setMessages((cur) => [...cur, { role: "user", content: text }]);
    setInput("");

    chat.mutate({
      threadId,
      message: text,
      // 첫 turn 에만 프로필을 실어 보냄
      profile: !firstTurnSent && profile ? profile : undefined,
    });
    if (!firstTurnSent) setFirstTurnSent(true);
  }

  function onReset() {
    resetThreadId();
    setThreadId(getOrCreateThreadId());
    setMessages([]);
    setFirstTurnSent(false);
  }

  return (
    <div className="rounded-xl border bg-white flex flex-col h-[70vh]">
      <div className="border-b px-4 py-2 flex items-center justify-between text-sm">
        <div className="text-slate-500">
          thread: <code className="text-xs">{threadId.slice(0, 8)}…</code>
          {profile && (
            <span className="ml-2 text-slate-400">
              (프로필 로드됨: {profile.age}세 · {profile.employmentType})
            </span>
          )}
        </div>
        <button
          onClick={onReset}
          className="text-slate-500 hover:text-slate-800"
        >
          새 대화
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-sm text-slate-400 py-10">
            {profile
              ? "프로필을 참고해서 답변합니다. 궁금한 걸 물어보세요."
              : "프로필을 먼저 입력하면 더 정확한 상담을 받을 수 있어요."}
          </div>
        )}
        {messages.map((m, i) => (
          <Bubble key={i} msg={m} />
        ))}
        {chat.isPending && (
          <div className="text-sm text-slate-500">
            <div className="inline-block bg-slate-100 rounded-lg px-3 py-2 animate-pulse">
              생각 중…
            </div>
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="border-t p-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="예: 전세자금 대출 조건이 궁금해요"
          className="flex-1 px-3 py-2 border rounded-lg"
          disabled={chat.isPending}
        />
        <button
          type="submit"
          disabled={chat.isPending || !input.trim()}
          className="px-4 py-2 bg-brand-600 text-white font-semibold rounded-lg disabled:opacity-50"
        >
          보내기
        </button>
      </form>
    </div>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
          isUser
            ? "bg-brand-600 text-white"
            : "bg-slate-100 text-slate-900"
        }`}
      >
        <div className="whitespace-pre-wrap leading-relaxed text-sm">
          {msg.content}
        </div>
        {msg.sources && msg.sources.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-500">
            📄 참고:{" "}
            {msg.sources
              .map((s) => (s.url ? `${s.title}` : s.title))
              .join(" · ")}
          </div>
        )}
      </div>
    </div>
  );
}
