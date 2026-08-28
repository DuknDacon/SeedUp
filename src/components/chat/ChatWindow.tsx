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
import { Bot, Settings2, Sparkles } from "lucide-react";
import { sendChat } from "@/services/chatApi";
import {
  clearProfile,
  getOrCreateThreadId,
  loadProfile,
  mergeProfile,
  resetThreadId,
  saveProfile,
} from "@/lib/profileStorage";
import type { ChatBlock, ProfileAskField, UserProfile } from "@/types/api";
import { ChatBlockRenderer } from "./ChatBlockRenderer";
import {
  IntegratedProfileForm,
  isIntegratedProfileComplete,
} from "./IntegratedProfileForm";

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
  "profile_ask",
]);

const isResultBlock = (b: ChatBlock) => RESULT_BLOCK_TYPES.has(b.type);

export function ChatWindow() {
  const [threadId, setThreadId] = useState<string>("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  // 프로필 폼 표시 상태. 최초 진입시엔 프로필 완성 여부로, 이후엔 상단
  // "조건 재입력" 버튼 클릭으로 열린다.
  //   null   → 아직 판정 전 (localStorage 로드 대기)
  //   true   → 폼 노출 (chat 은 잠금)
  //   false  → chat 활성
  const [showForm, setShowForm] = useState<boolean | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoSentRef = useRef(false);
  const initialRoadmapRequestedRef = useRef(false);

  useEffect(() => {
    setThreadId(getOrCreateThreadId());
    const p = loadProfile();
    setProfile(p);
    // 두 하위 에이전트 모두가 요구하는 조건이 다 채워져 있어야 대화 시작.
    setShowForm(!isIntegratedProfileComplete(p));
  }, []);

  // 온보딩의 "자유 질문"은 첫 메시지로 자동 전송되는 게 의도. 한 번 보내면
  // 다음 방문 때 중복 전송되지 않도록 프로필에서 소비(제거)한다.
  // 통합 폼(위)이 열려 있는 동안엔 자동 전송을 미룬다.
  useEffect(() => {
    if (autoSentRef.current) return;
    if (showForm !== false || messages.length === 0) return;
    if (!threadId || !profile?.freeTextQuery) return;
    autoSentRef.current = true;
    const question = profile.freeTextQuery;
    const updated = { ...profile, freeTextQuery: null };
    saveProfile(updated);
    setProfile(updated);
    sendMessage(question);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, messages.length, profile, showForm]);

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

  useEffect(() => {
    if (showForm !== false || !threadId || !profile) return;
    if (initialRoadmapRequestedRef.current || messages.length > 0) return;
    initialRoadmapRequestedRef.current = true;
    requestInitialRoadmap(profile);
    // requestInitialRoadmap는 현재 thread/profile을 사용해 최초 1회만 호출한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm, threadId, profile, messages.length]);

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

  function requestInitialRoadmap(nextProfile: UserProfile) {
    if (chat.isPending) return;
    chat.mutate({
      threadId,
      message: "입력한 조건으로 자산관리 로드맵을 만들어줘.",
      profile: nextProfile,
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
      "추가 정보를 반영해서 자산관리 로드맵을 다시 만들어줘. 제공된 정보: " +
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
    clearProfile();
    setThreadId(getOrCreateThreadId());
    setProfile(null);
    setMessages([]);
    setShowForm(true);
    initialRoadmapRequestedRef.current = false;
  }

  /** 통합 프로필 폼 제출 콜백 — 저장 후 대화 시작(또는 이어서). */
  function onIntegratedProfileSubmit(next: UserProfile) {
    saveProfile(next);
    setProfile(next);
    setShowForm(false);
    initialRoadmapRequestedRef.current = true;
    requestInitialRoadmap(next);
  }

  // 가장 최근 assistant 턴에서 나온 로드맵 결과 블록만 오른쪽 패널로 승격.
  // 마지막 assistant 응답이 결과 블록을 안 담고 있으면 그 이전 응답을 찾아 유지한다
  // (예: 사용자가 "왜?"라고 되물어서 답이 텍스트뿐이어도 이전 카드는 그대로 보이게).
  const latestRoadmapBlocks = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== "assistant") continue;
      const results = m.blocks.filter(
        (b) => b.type === "roadmap_plan" || b.type === "profile_ask"
      );
      if (results.length > 0) return results;
    }
    return [] as ChatBlock[];
  })();

  // 정책(기능①) 결과는 통합 테스트 확인용으로 하단에 별도 표시.
  // TODO: 통합 테스트 끝나면 이 파생값과 아래 하단 섹션 JSX를 통째로 제거.
  const latestPolicyBlocks = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== "assistant") continue;
      const results = m.blocks.filter(
        (b) =>
          b.type === "policy_results" ||
          b.type === "loan_detail" ||
          b.type === "sql_table"
      );
      if (results.length > 0) return results;
    }
    return [] as ChatBlock[];
  })();

  // 최초 진입 판정 전(showForm === null) — 깜빡임 방지 스켈레톤.
  if (showForm === null) {
    return <div className="h-[60vh] rounded-xl border bg-white animate-pulse" />;
  }

  // 프로필 미완이면 우선 폼만 크게 노출해 대화 자체를 잠근다.
  // 완성된 상태에서 "조건 재입력"을 눌러 다시 열 때도 같은 폼을 재사용하되,
  // 그 경우엔 취소로 원 대화로 돌아갈 수 있게 한다.
  if (showForm) {
    const isRe = isIntegratedProfileComplete(profile);
    return (
      <div className="max-w-3xl mx-auto rounded-xl border bg-white p-5">
        <div className="flex items-center mb-3">
          <span className="w-10 h-10 grid place-items-center bg-brand-100 text-brand-700 rounded-md mr-3">
            <Settings2 size={21} />
          </span>
          <div>
            <h2 className="text-base font-semibold">
              {isRe ? "조건 재입력" : "통합 상담 시작 전 조건 입력"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              정책 매칭(기능①)과 자산관리 로드맵(기능②) 모두에 필요한 조건을
              한 번에 저장합니다. 대화 도중에는 상단 "조건 재입력" 버튼으로 다시
              열 수 있어요.
            </p>
          </div>
        </div>
        <IntegratedProfileForm
          initial={profile}
          onSubmit={onIntegratedProfileSubmit}
          onCancel={isRe ? () => setShowForm(false) : undefined}
        />
      </div>
    );
  }

  return (
    <>
    <div className="grid grid-cols-1 md:grid-cols-[minmax(340px,420px)_1fr] gap-5 items-start">
      {/* 왼쪽: 채팅 (기능②의 chat-section 위치와 동일) */}
      <div className="rounded-xl border bg-white flex flex-col h-[75vh] md:sticky md:top-5 overflow-hidden">
        {/* 채팅 헤딩: 아이콘·타이틀·안내·온라인 표시 */}
        <div className="flex items-center px-5 py-4 border-b border-slate-200">
          <span className="w-10 h-10 grid place-items-center bg-brand-100 text-brand-700 rounded-md mr-3 flex-shrink-0">
            <Bot size={21} />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-slate-900 truncate">
              SeedUp AI 상담
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              조건을 바꾸려면 우측 상단 <b>조건 재입력</b>을 눌러주세요.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            title="저장된 조건을 다시 입력합니다"
            className="ml-auto mr-3 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 border border-brand-200 bg-brand-50 hover:bg-brand-100 rounded-md px-2 py-1"
          >
            <Settings2 size={12} />
            조건 재입력
          </button>
          <span className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-shrink-0">
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
            title="대화 내용과 저장된 프로필(생년월일·소득 등)을 모두 지우고 새로 시작합니다. 다른 사람과 이 기기를 함께 쓴다면 이용 후 눌러주세요."
            className="text-slate-500 hover:text-slate-800 flex-shrink-0 ml-2"
          >
            새 대화
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-sm text-slate-400 py-10">
              저장된 조건으로 자산관리 로드맵을 만들고 있어요.
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
            placeholder="예: 월 저축액을 60만 원으로 바꿔줘"
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
        {latestRoadmapBlocks.length === 0 ? (
          <div className="flex flex-col items-center text-center text-sm text-slate-400 py-12">
            <span className="w-11 h-11 grid place-items-center rounded-full bg-brand-50 text-brand-500 mb-3">
              <Sparkles size={20} />
            </span>
            입력한 조건을 확인하면 맞춤 로드맵이 이 패널에 표시됩니다.
          </div>
        ) : (
          <div className="space-y-4">
            {latestRoadmapBlocks.map((b, i) => (
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

    {latestPolicyBlocks.length > 0 && (
      <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50/40 p-4">
        <div className="mb-3 text-xs font-semibold text-amber-700 uppercase tracking-wide">
          🧪 테스트용 — 기능① 최신 결과 (통합 테스트 끝나면 이 섹션만 삭제하면 됨)
        </div>
        <div className="space-y-4">
          {latestPolicyBlocks.map((b, i) => (
            <ChatBlockRenderer
              key={i}
              block={b}
              onSuggestionClick={sendMessage}
              onProfileAsk={onProfileAskSubmit}
            />
          ))}
        </div>
      </div>
    )}
    </>
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
