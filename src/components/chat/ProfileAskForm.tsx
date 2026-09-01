/**
 * 통합 상담에서 로드맵/정책 호출 전 필수 프로필 필드가 부족할 때,
 * 라우터가 반환한 `profile_ask` 블록을 렌더하는 미니 폼.
 *
 * 폼 제출 → 부모(ChatWindow)가 프로필 localStorage 를 병합 갱신하고
 * 다음 turn 을 자동 발송한다. 사용자가 다시 채팅에 문장을 쓰지 않아도
 * "필드 채웠으니 다시 시도해줘" 흐름이 자연스럽게 이어지도록 함.
 */
"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import type { ProfileAskField, UserProfile } from "@/types/api";

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitted) return;

    // 입력값을 필드의 inputType 에 맞춰 캐스팅해서 patch 로 만든다.
    const patch: Partial<UserProfile> = {};
    for (const f of fields) {
      const raw = (values[f.key] ?? "").trim();
      if (!raw) continue;
      if (f.inputType === "number") {
        const n = Number(raw.replace(/[,_\s]/g, ""));
        if (!Number.isNaN(n)) (patch as Record<string, unknown>)[f.key] = n;
      } else if (f.inputType === "boolean") {
        (patch as Record<string, unknown>)[f.key] = raw === "true";
      } else {
        (patch as Record<string, unknown>)[f.key] = raw;
      }
    }
    if (Object.keys(patch).length === 0) return;
    setSubmitted(true);
    onSubmit?.(patch, fields);
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
      <div className="space-y-2">
        {fields.map((f) => (
          <div key={f.key} className="flex flex-col gap-1">
            <label className="text-[12px] text-slate-700">{f.question}</label>
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
                <option value="true">예</option>
                <option value="false">아니오</option>
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
          disabled={submitted}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {submitted ? "전송됨" : "저장하고 다시 시도"}
        </button>
      </div>
    </form>
  );
}
