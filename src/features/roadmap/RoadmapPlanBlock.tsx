"use client";

import { useState } from "react";
import { Check, CircleAlert, ExternalLink, Sparkles } from "lucide-react";
import type { RoadmapPlanPayload, Scenario } from "@/types/api";
import { ScenarioComparisonTable } from "@/components/roadmap/ScenarioComparisonTable";
import { TextWithGlossary } from "@/components/roadmap/TermTooltip";

const won = (value?: number | null) =>
  value == null ? "-" : `${Math.round(value).toLocaleString("ko-KR")}원`;

export function RoadmapPlanBlock({ plan }: { plan: RoadmapPlanPayload }) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3">
        <div className="text-xs font-semibold text-blue-800">맞춤 자산관리 로드맵</div>
        <p className="mt-1 text-sm leading-relaxed text-slate-700">{plan.summary}</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">{plan.notice}</p>
      </div>
      <RoadmapScenarioCard scenario={plan.recommended} reason={plan.recommendedReason} primary />
      <RoadmapScenarioCard scenario={plan.alternative} reason={plan.alternativeReason} />
      <ScenarioComparisonTable
        recommended={plan.recommended}
        alternatives={plan.alternatives ?? []}
      />
    </div>
  );
}

function RoadmapScenarioCard({
  scenario,
  reason,
  primary = false,
}: {
  scenario: Scenario;
  reason?: string | null;
  primary?: boolean;
}) {
  const total = scenario.allocations.reduce((sum, item) => sum + item.amount, 0);
  const evidence = scenario.evidence.find((item) => item.url) ?? scenario.evidence[0];

  return (
    <article className={`rounded-lg border bg-white p-4 ${primary ? "border-blue-300 border-t-[3px]" : "border-slate-200"}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700">
          {primary && <Sparkles size={13} />}
          {scenario.badge}
        </span>
        <span className="text-[11px] text-slate-500">{scenario.productType}</span>
      </div>
      <h3 className="mt-3 text-lg font-bold text-slate-900">{scenario.title}</h3>

      <div className="mt-3 grid grid-cols-2 border-l border-t border-slate-200">
        <Metric label="원금" value={won(scenario.principal)} />
        <Metric label="예상액" value={won(scenario.expectedAmount)} />
        <Metric label="목표 달성률" value={scenario.goalRate == null ? "-" : `${scenario.goalRate.toFixed(1)}%`} />
        <Metric label="부족액" value={won(scenario.shortfall)} />
      </div>

      <div className="mt-4 rounded-md bg-slate-50 p-3">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-700">
          <span>월 배분</span>
          <span>{won(total)}</span>
        </div>
        <div className="space-y-2">
          {scenario.allocations.map((item) => (
            <div key={item.label} className="grid grid-cols-[10px_1fr_auto] items-center gap-2 text-xs">
              <i className="h-2 w-2 rounded-sm" style={{ backgroundColor: item.color }} />
              <span className="text-slate-600">{item.label}</span>
              <strong className="text-slate-800">{won(item.amount)}</strong>
            </div>
          ))}
        </div>
      </div>

      {reason && <p className="mt-3 text-xs leading-relaxed text-slate-600"><TextWithGlossary text={reason} /></p>}
      {scenario.highlights.map((text) => (
        <p key={text} className="mt-2 flex items-start gap-2 text-xs leading-relaxed text-slate-600">
          <Check size={14} className="mt-0.5 shrink-0 text-blue-600" /><TextWithGlossary text={text} />
        </p>
      ))}
      {scenario.warnings.map((text) => (
        <p key={text} className="mt-2 flex items-start gap-2 rounded bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
          <CircleAlert size={14} className="mt-0.5 shrink-0" /><TextWithGlossary text={text} />
        </p>
      ))}
      {evidence && (
        evidence.url ? (
          <a href={evidence.url} target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 text-xs text-slate-600 hover:text-blue-700">
            <span><small className="block text-slate-400">공식 근거</small>{evidence.title} · {evidence.organization}</span>
            <ExternalLink size={15} />
          </a>
        ) : (
          <div className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-500">{evidence.title}</div>
        )
      )}
      {primary && <ActionChecklist evidenceUrl={evidence?.url} />}
    </article>
  );
}

/** 추천 시나리오에 붙는 "다음 단계" 실행 체크리스트 — 고정 문구, 로컬 상태만 유지(영구저장 없음). */
function ActionChecklist({ evidenceUrl }: { evidenceUrl?: string }) {
  const items = [
    evidenceUrl
      ? { label: "공식 페이지에서 최신 조건 확인", href: evidenceUrl }
      : { label: "공식 페이지에서 최신 조건 확인" },
    { label: "필요 서류 준비" },
    { label: "운영기관에 문의·신청" },
  ];
  const [checked, setChecked] = useState<boolean[]>(() => items.map(() => false));

  return (
    <div className="mt-3 border-t border-slate-200 pt-3">
      <div className="text-[11px] font-semibold text-slate-500 mb-2">다음 단계</div>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <label key={item.label} className="flex items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={checked[i]}
              onChange={() =>
                setChecked((cur) => cur.map((v, idx) => (idx === i ? !v : v)))
              }
              className="accent-brand-600"
            />
            <span className={checked[i] ? "line-through text-slate-400" : ""}>
              {"href" in item ? (
                <a
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-dotted hover:text-brand-700"
                  onClick={(e) => e.stopPropagation()}
                >
                  {item.label}
                </a>
              ) : (
                item.label
              )}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-r border-slate-200 p-3">
      <span className="block text-[11px] text-slate-500">{label}</span>
      <strong className="mt-1 block text-sm text-slate-900">{value}</strong>
    </div>
  );
}
