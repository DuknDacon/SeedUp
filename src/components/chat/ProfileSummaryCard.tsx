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

/** dynamicGateAnswers는 "policyId:gateId" 합성 키라 PROFILE_FIELD_SUMMARY의
 * 고정 필드 목록에 넣을 수 없다 — 상품마다 다른 키가 대화 중에 동적으로
 * 생긴다. 같은 시점에 저장해둔 dynamicGateLabels에서 질문 문구를 찾아
 * 보여주고, 옛 프로필처럼 라벨이 없으면 원본 키라도 보여준다. */
function dynamicGateEntries(profile: Partial<UserProfile> | null) {
  const answers = profile?.dynamicGateAnswers ?? {};
  const labels = profile?.dynamicGateLabels ?? {};
  return Object.entries(answers).map(([key, value]) => ({
    key,
    label: labels[key] ?? key,
    value,
  }));
}

/** 답변이 많으면(실제로 12개까지 나옴) 정책 구분 없이 나열해선 훑어보기
 * 힘들다는 실사용자 피드백으로, 합성 키의 policyId로 묶는다 — 숨기진
 * 않는다(사용자가 자기 조건을 정확히 알아야 한다는 요구), 정책별로만
 * 묶어서 12줄이 3~4개 그룹으로 보이게 한다. */
function groupByPolicy(
  entries: ReturnType<typeof dynamicGateEntries>,
  policyNames: Record<string, string>,
) {
  const groups = new Map<string, { name: string; entries: typeof entries }>();
  for (const entry of entries) {
    const policyId = entry.key.split(":")[0] ?? entry.key;
    const group = groups.get(policyId);
    if (group) {
      group.entries.push(entry);
    } else {
      // 정책 원본 ID(예: "20260625005400113245")는 사용자에게 노출될 이유가
      // 없는 내부 식별자다 — ChatWindow가 대화 전체에서 이름을 누적해도
      // 한 번도 카드에 안 나온 정책이면 여전히 못 찾을 수 있는데, 그때도
      // raw ID 대신 사람이 읽을 수 있는 문구로 대체한다.
      groups.set(policyId, { name: policyNames[policyId] ?? "정책명 확인 중", entries: [entry] });
    }
  }
  return Array.from(groups.values());
}

export function ProfileSummaryCard({
  profile,
  activeStep,
  onEditStep,
  policyNames,
  onEditDynamicGate,
}: {
  profile: Partial<UserProfile> | null;
  /** 폼 안에서 쓸 때: 지금 보고 있는 단계 제목을 강조 표시. */
  activeStep?: number;
  /** 있으면 각 줄이 클릭 가능해지고, 그 필드가 속한 단계 번호로 이동을 요청한다. */
  onEditStep?: (step: number) => void;
  /** "policyId:gateId" 합성 키의 policyId → 정책명. 있으면 "상품별 추가
   * 자격조건"을 정책별로 묶어서 보여준다(ChatWindow의 최신 자격 카드에서
   * 만듦). 없으면(온보딩 폼 쪽 재사용) policyId를 그대로 그룹 이름으로 쓴다. */
  policyNames?: Record<string, string>;
  /** 있으면 각 동적 게이트 답변을 인라인 select로 바로 수정할 수 있다. */
  onEditDynamicGate?: (key: string, label: string, value: boolean) => void;
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
        {dynamicGateEntries(profile).length > 0 && (
          <div>
            <div className="text-[11px] font-semibold mb-1 text-slate-400">
              상품별 추가 자격조건
            </div>
            <div className="space-y-2">
              {groupByPolicy(dynamicGateEntries(profile), policyNames ?? {}).map((group, i) => (
                <div key={i}>
                  <div className="text-[11px] font-medium text-slate-500 mb-0.5 truncate">
                    {group.name}
                  </div>
                  <ul className="space-y-1">
                    {group.entries.map((entry) => (
                      // 예전엔 라벨(질문)과 select를 한 줄에 좌우로 배치했는데,
                      // select 옵션에 "예, 타 부처 또는 지방정부의 취업 관련
                      // 지원사업에 참여 중입니다." 같은 긴 문장이 들어가면서
                      // select 박스 자체가 넓어져 라벨이 밀려버렸다 — 남은
                      // 폭이 몇 픽셀밖에 안 남아 한글이 한 글자씩 세로로
                      // 줄바꿈되는 문제가 있었다(실사용자 스크린샷으로 발견).
                      // ProfileAskForm과 같은 세로 배치로 바꿔 폭에 상관없이
                      // 안전하게 만든다.
                      <li key={entry.key} className="text-xs px-1.5 py-1 rounded-md">
                        <div className="text-slate-500 mb-0.5">{entry.label}</div>
                        {onEditDynamicGate ? (
                          <select
                            value={entry.value ? "true" : "false"}
                            onChange={(e) =>
                              onEditDynamicGate(entry.key, entry.label, e.target.value === "true")
                            }
                            className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded px-1.5 py-1"
                          >
                            <option value="true">예</option>
                            <option value="false">아니오</option>
                          </select>
                        ) : (
                          <span className="font-medium text-slate-800">
                            {entry.value ? "예" : "아니오"}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
