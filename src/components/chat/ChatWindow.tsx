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
import { Bot } from "lucide-react";
import { sendChat } from "@/services/chatApi";
import {
  getOrCreateThreadId,
  loadProfile,
  mergeProfile,
  resetThreadId,
  saveProfile,
} from "@/lib/profileStorage";
import type { ChatBlock, ProfileAskField, UserProfile } from "@/types/api";
import { ChatBlockRenderer } from "./ChatBlockRenderer";

type Msg = {
  role: "user" | "assistant";
  blocks: ChatBlock[];
};

/**
 * 오른쪽 결과 패널로 승격되는 "큰 블록" 타입들.
 * 이 목록에 없는 블록(text/sources/suggested_replies)은 왼쪽 채팅 버블에 그대로 남는다.
 * 기능② 로드맵 화면의 "왼쪽=대화 / 오른쪽=추천·대안" 구성을 기능①에 맞춰 재현한다.
 */
const RESULT_BLOCK_TYPES: ReadonlySet<ChatBlock["type"]> = new Set([
  "policy_results",
  "loan_detail",
  "sql_table",
  "roadmap_plan",
]);

const isResultBlock = (b: ChatBlock) => RESULT_BLOCK_TYPES.has(b.type);

export function ChatWindow() {
  const [threadId, setThreadId] = useState<string>("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
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
      // 라우터/하위 에이전트가 프로필을 조정했으면 (예: Roadmap-Agent 의
      // requestPatch) localStorage 를 병합 갱신해 다음 turn 부터 반영.
      if (res.profilePatch && Object.keys(res.profilePatch).length > 0) {
        const merged = mergeProfile(res.profilePatch);
        if (merged) setProfile(merged);
      }
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

  /** 폼 제출과 suggested_replies chip 클릭이 공유하는 전송 로직.
   *
   * 프로필은 **매 turn** 실어 보낸다. Roadmap-Agent 는 매 요청마다 프로필
   * 전량을 요구하고, slot-fill 로 방금 채운 필드가 다음 turn 에 반드시 실려야
   * 하기 때문. 라우터의 프로필 캐시가 있긴 하지만 브라우저 새로고침·재접속
   * 상황에서 프로필이 유실되지 않도록 프론트를 source of truth 로 유지한다.
   */
  function sendMessage(text: string, profileOverride?: UserProfile | null) {
    const trimmed = text.trim();
    if (!trimmed || chat.isPending) return;

    setMessages((cur) => [
      ...cur,
      { role: "user", blocks: [{ type: "text", content: trimmed }] },
    ]);
    setInput("");

    const nextProfile = profileOverride ?? profile;
    chat.mutate({
      threadId,
      message: trimmed,
      profile: nextProfile ?? undefined,
    });
  }

  /** profile_ask 미니 폼 제출 콜백. 필드값을 프로필에 병합 저장하고 자동으로
   * 다음 turn 을 발송한다 — 사용자는 채팅에 문장을 다시 안 써도 됨. */
  function onProfileAskSubmit(
    patch: Partial<UserProfile>,
    fields: ProfileAskField[],
  ) {
    const merged = mergeProfile(patch);
    if (merged) setProfile(merged);
    const answerText =
      "제공된 정보: " +
      fields
        .map((f) => `${f.label}=${(patch as Record<string, unknown>)[f.key] ?? "-"}`)
        .join(", ");
    // 병합된 프로필을 즉시 실어보내기 위해 override 로 넘김 (setState 반영 지연 회피).
    sendMessage(answerText, merged);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function onReset() {
    resetThreadId();
    setThreadId(getOrCreateThreadId());
    setMessages([]);
  }

  // 가장 최근 assistant 턴에서 나온 "큰 블록"들만 오른쪽 패널로 승격.
  // 마지막 assistant 응답이 결과 블록을 안 담고 있으면 그 이전 응답을 찾아 유지한다
  // (예: 사용자가 "왜?"라고 되물어서 답이 텍스트뿐이어도 이전 카드는 그대로 보이게).
  const latestResultBlocks = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== "assistant") continue;
      const results = m.blocks.filter(isResultBlock);
      if (results.length > 0) return results;
    }
    return [] as ChatBlock[];
  })();

  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(340px,420px)_1fr] gap-5 items-start">
      {/* 왼쪽: 채팅 (기능②의 chat-section 위치와 동일) */}
      <div className="rounded-xl border bg-white flex flex-col h-[75vh] md:sticky md:top-5 overflow-hidden">
        {/* 기능② RoadmapExperience 의 .chat-heading 과 동일한 구성 (아이콘·타이틀·안내·온라인) */}
        <div className="flex items-center px-5 py-4 border-b border-slate-200">
          <span className="w-10 h-10 grid place-items-center bg-brand-100 text-brand-700 rounded-md mr-3 flex-shrink-0">
            <Bot size={21} />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="m-0">
              <span className="inline-flex items-center px-2.5 py-1 rounded-md border border-sky-300 bg-sky-50 text-sky-700 text-[13px] font-semibold">
                Policy Agent와 대화하기
              </span>
            </h2>
            <p className="text-[11px] text-slate-500 m-0 mt-1.5">
              조건을 바꾸거나 추천 이유를 물어보세요.
            </p>
          </div>
          <span className="ml-auto text-[11px] text-slate-500 flex items-center gap-1.5 flex-shrink-0">
            <i className="w-[7px] h-[7px] bg-emerald-500 rounded-full inline-block" />
            온라인
          </span>
        </div>
        <div className="border-b px-4 py-2 flex items-center justify-between text-xs">
          <div className="text-slate-400 truncate">
            thread: <code className="text-[11px]">{threadId.slice(0, 8)}…</code>
            {profile && (
              <span className="ml-2">
                (프로필 로드됨: {profile.age}세 · {profile.employmentType})
              </span>
            )}
          </div>
          <button
            onClick={onReset}
            className="text-slate-500 hover:text-slate-800 flex-shrink-0 ml-2"
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
            <Bubble
              key={i}
              msg={m}
              onSuggestionClick={sendMessage}
              onProfileAsk={onProfileAskSubmit}
            />
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

      {/* 오른쪽: 최신 결과 패널 (기능②의 scenario-grid 위치와 동일) */}
      <div className="rounded-xl border bg-white p-4 min-h-[240px]">
        <div className="mb-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          AI 추천 · 결과
        </div>
        {latestResultBlocks.length === 0 ? (
          <div className="text-center text-sm text-slate-400 py-12">
            대화를 시작하면 매칭된 정책·대출·로드맵이 이 패널에 표시됩니다.
          </div>
        ) : (
          <div className="space-y-4">
            {latestResultBlocks.map((b, i) => (
              <ChatBlockRenderer
                key={i}
                block={b}
                onSuggestionClick={sendMessage}
                onProfileAsk={onProfileAskSubmit}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Bubble({
  msg,
  onSuggestionClick,
  onProfileAsk,
}: {
  msg: Msg;
  onSuggestionClick: (text: string) => void;
  onProfileAsk: (patch: Partial<UserProfile>, fields: ProfileAskField[]) => void;
}) {
  const isUser = msg.role === "user";
  // 큰 결과 블록은 오른쪽 패널에서 렌더되므로 버블에서는 걸러낸다.
  // 결과 블록만 있고 대화용 텍스트가 없는 assistant 턴은 버블 자체를 그리지 않는다
  // (예: policy_results 하나만 온 경우 — 왼쪽에 빈 버블이 뜨지 않도록).
  const bubbleBlocks = msg.blocks.filter((b) => !isResultBlock(b));
  if (!isUser && bubbleBlocks.length === 0) return null;
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2 ${
          isUser ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-900"
        }`}
      >
        {bubbleBlocks.map((b, i) => (
          <ChatBlockRenderer
            key={i}
            block={b}
            onSuggestionClick={onSuggestionClick}
            onProfileAsk={onProfileAsk}
          />
        ))}
      </div>
    </div>
  );
}
