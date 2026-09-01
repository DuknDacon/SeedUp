/**
 * "지금까지 입력한 조건"을 단계별로 정리해 보여주는 카드.
 *
 * 두 곳에서 재사용한다:
 *  - IntegratedProfileForm 안: 입력 중인 값을 실시간으로 반영(값이 바뀔 때마다
 *    부모가 다시 만든 draft 객체를 그대로 넘김). onEditStep 은 넘기지 않는다
 *    (지금 그 폼 안에 있으므로 다시 이동할 필요가 없음).
 *  - ChatWindow: 저장된 profile 을 읽기 전용으로 보여주되, 각 줄을 누르면
 *    그 필드가 속한 단계로 폼을 열도록 onEditStep 을 넘긴다(조건 재입력 시
 *    1단계부터 다시 훑지 않고 해당 단계로 바로 이동).
 */
"use client";

import { ListChecks, Pencil } from "lucide-react";
import type { UserProfile } from "@/types/api";
import { PROFILE_FIELD_SUMMARY, STEP_META } from "@/lib/profileFieldMeta";

export function ProfileSummaryCard({
  profile,
  activeStep,
  onEditStep,
}: {
  profile: Partial<UserProfile> | null;
  /** 폼 안에서 쓸 때: 지금 보고 있는 단계 제목을 강조 표시. */
  activeStep?: number;
  /** 있으면 각 줄이 클릭 가능해지고, 그 필드가 속한 단계 번호로 이동을 요청한다. */
  onEditStep?: (step: number) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="flex items-center gap-1.5 font-semibold mb-3 text-[11px] text-slate-500 uppercase tracking-wide">
        <ListChecks size={13} />
        {onEditStep ? "현재 저장된 조건" : "지금까지 입력한 조건"}
      </h3>
      <div className="space-y-3">
        {STEP_META.map((meta, stepIdx) => (
          <div key={meta.title}>
            <div
              className={`text-[11px] font-semibold mb-1 ${
                activeStep === stepIdx ? "text-brand-700" : "text-slate-400"
              }`}
            >
              {stepIdx + 1}. {meta.title}
            </div>
            <ul className="space-y-0.5">
              {PROFILE_FIELD_SUMMARY.filter((f) => f.step === stepIdx).map((f) => {
                const val = f.value(profile);
                const clickable = Boolean(onEditStep);
                return (
                  <li
                    key={f.key}
                    onClick={clickable ? () => onEditStep?.(stepIdx) : undefined}
                    className={`flex items-center justify-between gap-2 text-xs px-1.5 py-1 rounded-md ${
                      clickable ? "cursor-pointer hover:bg-white" : ""
                    }`}
                  >
                    <span className="text-slate-500">{f.label}</span>
                    <span className="flex items-center gap-1 min-w-0">
                      <span
                        className={`truncate ${val ? "font-medium text-slate-800" : "text-slate-300"}`}
                      >
                        {val ?? "미입력"}
                      </span>
                      {clickable && (
                        <Pencil size={11} className="text-slate-300 flex-shrink-0" />
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
