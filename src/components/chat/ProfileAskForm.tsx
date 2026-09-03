/**
 * 통합 상담에서 로드맵/정책 호출 전 필수 프로필 필드가 부족할 때,
 * 라우터가 반환한 `profile_ask` 블록을 렌더하는 미니 폼.
 *
 * 폼 제출 → 부모(ChatWindow)가 프로필 localStorage 를 병합 갱신하고
 * 다음 turn 을 자동 발송한다. 사용자가 다시 채팅에 문장을 쓰지 않아도
 * "필드 채웠으니 다시 시도해줘" 흐름이 자연스럽게 이어지도록 함.
 *
 * 한 라운드에 남은 질문이 많으면(최대 11~12개) 한 화면에 다 나열하지 않고
 * CHUNK_SIZE개씩 끊어 보여준다("진짜 단계별"). 각 단계 제출은 그 단계에
 * 보이는 질문의 답만 담아 실제 서버 호출(onSubmit)을 트리거한다 — 서버가
 * 그 답을 반영해 다시 계산한 "남은 질문"(같은 상품이 그 답으로 이미
 * 탈락했다면 그 상품의 나머지 게이트는 아예 빠진 채로)이 새 라운드로
 * 돌아오고, ChatWindow가 새 profile_ask 블록으로 이 컴포넌트를 다시
 * 마운트하면서 자연스럽게 "다음 단계"가 이어진다. 즉 새 백엔드 엔드포인트나
 * 클라이언트 쪽 캐시 없이, 기존 라운드 매커니즘의 청크 크기만 줄인 것.
 */
"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import type { ProfileAskField, UserProfile } from "@/types/api";

const CHUNK_SIZE = 4;

export function ProfileAskForm({
  context,
  fields,
  stepNumber,
  onSubmit,
}: {
  context: "roadmap" | "policy";
  fields: ProfileAskField[];
  /** 온보딩 1~3단계에 이어지는 번호(4, 5, 6…)로 표시 — 이 질문이 고정된
   * 온보딩 단계가 아니라 AI가 대화 중 DB 매칭 결과를 보고 실시간으로 판단해
   * 추가한 질문임을 시각적으로 구분하기 위함. */
  stepNumber?: number;
  onSubmit?: (patch: Partial<UserProfile>, fields: ProfileAskField[]) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const heading =
    context === "roadmap"
      ? "로드맵을 만들려면 이 정보가 필요해요"
      : "정책 매칭을 위해 이 정보가 필요해요";

  // 서버가 내려준 순서 그대로, 앞에서부터 CHUNK_SIZE개만 이번 단계에서 보여준다.
  const visibleFields = fields.slice(0, CHUNK_SIZE);
  const remainingAfterThisStep = fields.length - visibleFields.length;
  const allVisibleAnswered = visibleFields.every((f) => (values[f.key] ?? "").trim() !== "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitted || !allVisibleAnswered) return;

    // 입력값을 필드의 inputType 에 맞춰 캐스팅해서 patch 로 만든다.
    // 이번 단계에 보이는 필드(visibleFields)만 반영한다 — 아직 안 보여준
    // 나머지는 다음 라운드(서버가 다시 계산해 돌려주는 다음 profile_ask)에서 묻는다.
    const patch: Partial<UserProfile> = {};
    const gateAnswers: Record<string, boolean> = {};
    for (const f of visibleFields) {
      const raw = (values[f.key] ?? "").trim();
      if (!raw) continue;
      if (f.isDynamicGate) {
        // 동적 게이트는 실제 UserProfile 필드가 아니라 "policyId:gateId" 합성
        // 키다 — patch[f.key]가 아니라 dynamicGateAnswers 맵에 모은다.
        gateAnswers[f.key] = raw === "true";
        continue;
      }
      if (f.inputType === "number") {
        const n = Number(raw.replace(/[,_\s]/g, ""));
        if (!Number.isNaN(n)) {
          // inputUnit === "만원"인 필드는 다른 폼 필드들과 같은 방식으로
          // 만원 단위 입력을 원 단위로 환산해서 저장한다(변환 누락 시 "4000"을
          // 4,000원으로 보내버려 사실상 미입력과 같아지는 버그가 있었음).
          (patch as Record<string, unknown>)[f.key] =
            f.inputUnit === "만원" ? Math.round(n * 10_000) : n;
        }
      } else if (f.inputType === "boolean") {
        (patch as Record<string, unknown>)[f.key] = raw === "true";
      } else {
        (patch as Record<string, unknown>)[f.key] = raw;
      }
    }
    if (Object.keys(gateAnswers).length > 0) {
      patch.dynamicGateAnswers = gateAnswers;
    }
    if (Object.keys(patch).length === 0) return;
    setSubmitted(true);
    onSubmit?.(patch, visibleFields);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm"
    >
      <div className="mb-2 flex items-center gap-2">
        {stepNumber != null && (
          <span className="w-6 h-6 flex-shrink-0 rounded-full grid place-items-center text-[11px] font-bold bg-violet-600 text-white">
            {stepNumber}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-700 bg-violet-100 rounded-full px-2 py-0.5">
          <Sparkles size={10} />
          AI가 대화로 판단해 추가한 질문
        </span>
      </div>
      <div className="mb-2 font-semibold text-amber-900">{heading}</div>
      {remainingAfterThisStep > 0 && (
        <p className="mb-2 text-[11px] font-medium text-violet-600">
          이번 단계 {visibleFields.length}개 확인 후 남은 {remainingAfterThisStep}개를 이어서 물어볼게요.
        </p>
      )}
      <p className="mb-3 text-[11px] text-slate-500 leading-snug">
        💬 용어가 헷갈리면 왼쪽 채팅창에 편하게 물어보고, 답을 참고해서
        아래를 입력해도 돼요.
      </p>
      <div className="space-y-2">
        {visibleFields.map((f) => (
          <div key={f.key} className="flex flex-col gap-1">
            <label className="text-[12px] text-slate-700">{f.question}</label>
            {f.hint && (
              <p className="text-[11px] text-slate-500 leading-snug">{f.hint}</p>
            )}
            {f.inputType === "boolean" ? (
              <select
                value={values[f.key] ?? ""}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [f.key]: e.target.value }))
                }
                disabled={submitted}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
              >
                <option value="" disabled>
                  선택해주세요
                </option>
                {/* 동적 게이트는 질문 문장의 주어까지 포함한 완전한 문장을
                    선택지로 받는다(f.yesLabel/noLabel) — "예/아니요"만
                    보여주면 위 질문이 뭘 물었는지 다시 훑어야 답을 고를 수
                    있다는 실사용자 피드백으로 바꿨다. 값이 없으면(레거시
                    4개 필드 등) "네, 맞아요"/"아니요, 아니에요" 기본 문구로
                    대체한다. */}
                <option value="true">{f.yesLabel || "네, 맞아요"}</option>
                <option value="false">{f.noLabel || "아니요, 아니에요"}</option>
              </select>
            ) : (
              <input
                type={f.inputType === "number" ? "number" : f.inputType === "date" ? "date" : "text"}
                inputMode={f.inputType === "number" ? "numeric" : undefined}
                value={values[f.key] ?? ""}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [f.key]: e.target.value }))
                }
                placeholder={f.label}
                disabled={submitted}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
              />
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="submit"
          disabled={submitted || !allVisibleAnswered}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {submitted
            ? "전송됨"
            : remainingAfterThisStep > 0
              ? "다음 단계로"
              : "저장하고 다시 시도"}
        </button>
      </div>
    </form>
  );
}
