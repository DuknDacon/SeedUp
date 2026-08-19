/**
 * 통합 챗 UI. thread_id 로 대화 상태를 이어감.
 * 첫 번째 메시지에만 profile 을 함께 보내서 에이전트가 컨텍스트로 활용하게 함.
 *
 * 기능①(정책 금융)과 기능②(자산관리 로드맵)를 별도 화면으로 나누지 않고,
 * 이 화면 하나에서 자연스럽게 이어 대화하도록 통합했다. 메시지는 텍스트 하나가
 * 아니라 ChatBlock[] 이라 구조화된 조회 결과/제안 질문이 대화 중간에 그대로 끼어든다
 * (렌더링은 ChatBlockRenderer 가 담당).
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { sendChat } from "@/services/chatApi";
import {
  getOrCreateThreadId,
  loadProfile,
  resetThreadId,
  saveProfile,
} from "@/lib/profileStorage";
import type { ChatBlock, UserProfile } from "@/types/api";
import { ChatBlockRenderer } from "./ChatBlockRenderer";

type Msg = {
  role: "user" | "assistant";
  blocks: ChatBlock[];
};

export function ChatWindow() {
  const [threadId, setThreadId] = useState<string>("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [firstTurnSent, setFirstTurnSent] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoSentRef = useRef(false);

  useEffect(() => {
    setThreadId(getOrCreateThreadId());
    setProfile(loadProfile());
  }, []);

  // 온보딩의 "자유 질문"은 첫 메시지로 자동 전송되는 게 의도. 한 번 보내면
  // 다음 방문 때 중복 전송되지 않도록 프로필에서 소비(제거)한다.
  useEffect(() => {
    if (autoSentRef.current) return;
    if (!threadId || !profile?.freeTextQuery) return;
    autoSentRef.current = true;
    const question = profile.freeTextQuery;
    const updated = { ...profile, freeTextQuery: null };
    saveProfile(updated);
    setProfile(updated);
    sendMessage(question);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, profile]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const chat = useMutation({
    mutationFn: sendChat,
    onSuccess: (res) => {
      setMessages((cur) => [...cur, { role: "assistant", blocks: res.blocks }]);
    },
    onError: () => {
      setMessages((cur) => [
        ...cur,
        {
          role: "assistant",
          blocks: [
            {
              type: "text",
              content: "일시적인 오류로 답변을 생성하지 못했어요. 잠시 후 다시 시도해 주세요.",
            },
          ],
        },
      ]);
    },
  });

  /** 폼 제출과 suggested_replies chip 클릭이 공유하는 전송 로직 */
  function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || chat.isPending) return;

    setMessages((cur) => [
      ...cur,
      { role: "user", blocks: [{ type: "text", content: trimmed }] },
    ]);
    setInput("");

    chat.mutate({
      threadId,
      message: trimmed,
      // 첫 turn 에만 프로필을 실어 보냄
      profile: !firstTurnSent && profile ? profile : undefined,
    });
    if (!firstTurnSent) setFirstTurnSent(true);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function onReset() {
    resetThreadId();
    setThreadId(getOrCreateThreadId());
    setMessages([]);
    setFirstTurnSent(false);
  }

  return (
    <div className="rounded-xl border bg-white flex flex-col h-[75vh]">
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
              ? "프로필을 참고해서 답변합니다. 정책 금융이든 자산관리 로드맵이든 편하게 물어보세요."
              : "프로필을 먼저 입력하면 더 정확한 상담을 받을 수 있어요."}
          </div>
        )}
        {messages.map((m, i) => (
          <Bubble key={i} msg={m} onSuggestionClick={sendMessage} />
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

function Bubble({
  msg,
  onSuggestionClick,
}: {
  msg: Msg;
  onSuggestionClick: (text: string) => void;
}) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2 ${
          isUser ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-900"
        }`}
      >
        {msg.blocks.map((b, i) => (
          <ChatBlockRenderer
            key={i}
            block={b}
            onSuggestionClick={onSuggestionClick}
          />
        ))}
      </div>
    </div>
  );
}
