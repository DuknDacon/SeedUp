"use client";

import { useState } from "react";
import { Check, CircleAlert, ExternalLink, Sparkles } from "lucide-react";
import type { RoadmapPlanPayload, Scenario } from "@/types/api";
import { ScenarioComparisonTable } from "@/components/roadmap/ScenarioComparisonTable";
import { TextWithGlossary } from "@/components/roadmap/TermTooltip";
import {
  MoneyTreeIllustration,
  type TreeStage,
} from "@/components/landing/MoneyTreeIllustration";

const won = (value?: number | null) =>
  value == null ? "-" : `${Math.round(value).toLocaleString("ko-KR")}원`;

/** 목표 달성률을 랜딩페이지와 같은 "씨앗→돈나무" 성장 단계로 매핑 — 서비스 시그니처 재사용. */
function goalRateToTreeStage(goalRate: number | null | undefined): TreeStage {
  if (goalRate == null) return 0;
  if (goalRate >= 100) return 4;
  if (goalRate >= 75) return 3;
  if (goalRate >= 50) return 2;
  if (goalRate >= 25) return 1;
  return 0;
}

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

      <MetricsPanel scenario={scenario} />

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
      <ActionChecklist evidenceUrl={evidence?.url} />
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
              className="w-3.5 h-3.5 flex-shrink-0 accent-brand-600"
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

/**
 * 원금·예상액·목표달성률·부족액을 막대 하나로 통합 시각화.
 * 0→원금(파랑)→예상액(초록, 성장분)→(부족분 있으면) 목표까지 남은 구간(회색 빗금).
 */
function MetricsPanel({ scenario }: { scenario: Scenario }) {
  const { principal, expectedAmount, goalRate, shortfall } = scenario;
  const achieved = shortfall == null || shortfall <= 0;
  const gap = achieved ? 0 : shortfall;

  const principalAmt = principal ?? 0;
  const expectedAmt = expectedAmount ?? 0;
  const growth = Math.max(expectedAmt - principalAmt, 0);
  // 부족분까지 포함한 막대 전체 길이 — 목표 지점까지 한눈에 보이게.
  const barTotal = Math.max(expectedAmt + gap, principalAmt, 1);
  const principalPct = (principalAmt / barTotal) * 100;
  const growthPct = (growth / barTotal) * 100;
  // gapPct는 나머지 두 구간에서 뺀 값으로 계산한다 — 셋을 각각 독립적으로
  // 반올림하면 합이 100%에 살짝 못 미쳐, 막대 끝에 아무 색도 없는 회색
  // 트랙(bg-slate-100, 원래는 그냥 배경일 뿐)이 비쳐 보인다. 그게 마치
  // 범례에 없는 "네 번째 구간"처럼 보여 헷갈린다는 실사용자 피드백으로 수정.
  const gapPct = achieved ? 0 : Math.max(100 - principalPct - growthPct, 0);

  return (
    <div className="mt-3 flex items-start gap-3">
      <MoneyTreeIllustration
        stage={goalRateToTreeStage(goalRate)}
        className="w-12 h-12 flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
        <span>
          원금 <b className="text-slate-700">{won(principal)}</b> → 예상액{" "}
          <b className="text-slate-700">{won(expectedAmount)}</b>
        </span>
        <span className="font-semibold text-slate-700">
          {goalRate == null ? "-" : `${goalRate.toFixed(1)}%`}
        </span>
      </div>
      {/* 막대 전체 길이 = 목표 금액. 왼쪽 끝(0)에서 오른쪽 끝까지 채워지면
          목표를 100% 달성했다는 뜻 — 오른쪽 끝에 "목표" 라벨을 달아 이 막대가
          무엇의 진행률인지 바로 알 수 있게 한다. */}
      <div className="h-3 flex rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full bg-brand-400" style={{ width: `${principalPct}%` }} />
        <div className="h-full bg-sprout-500" style={{ width: `${growthPct}%` }} />
        {!achieved && (
          <div
            className="h-full bg-[repeating-linear-gradient(45deg,#fecdd3,#fecdd3_4px,#fff1f2_4px,#fff1f2_8px)]"
            style={{ width: `${gapPct}%` }}
          />
        )}
      </div>
      <div className="mt-0.5 flex items-center justify-between text-[9px] text-slate-300">
        <span>0원</span>
        <span>{achieved ? "예상액" : "목표 지점"}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
        <span className="inline-flex items-center gap-1">
          <i className="h-2 w-2 rounded-sm bg-brand-400" /> 원금
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="h-2 w-2 rounded-sm bg-sprout-500" /> 예상 수익
        </span>
        {!achieved && (
          <span className="inline-flex items-center gap-1">
            <i className="h-2 w-2 rounded-sm bg-[repeating-linear-gradient(45deg,#fecdd3,#fecdd3_2px,#fff1f2_2px,#fff1f2_4px)]" />{" "}
            목표까지 부족액
          </span>
        )}
      </div>
      <div className="mt-1">
        {achieved ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sprout-700">
            ✓ 목표 달성
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600">
            목표까지 {won(shortfall)} 부족
          </span>
        )}
      </div>
      </div>
    </div>
  );
}
