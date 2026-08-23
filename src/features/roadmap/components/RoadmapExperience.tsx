"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import {
  ArrowRight, Bot, CalendarDays, Check, ChevronDown, CircleAlert,
  ExternalLink, PencilLine, Send, ShieldCheck, Sparkles, Target, TrendingUp,
} from "lucide-react";
import { createRoadmap } from "@/services/roadmapApi";
import type { RoadmapRequest, RoadmapResponse, Scenario } from "@/types/api";

/**
 * 입력 화면 전용 초안 타입. 필수 항목도 사용자가 실제로 입력하기 전까지는
 * null/빈 문자열로 두어 "기본값이 채워진 것"과 "아직 입력 안 함"을 구분한다.
 * 제출 시 검증을 통과한 뒤에만 `RoadmapRequest`(전송 계약 타입)로 좁힌다.
 *
 * 예외: `region`/`regionProvinceCode`/`regionDistrictCode`는 아직 실제 지역
 * 선택 UI가 붙어 있지 않아(고정된 버튼) 비워두면 완료 자체가 불가능해지므로
 * 임시 기본값을 유지한다. `householdSize`는 최소값 1의 스테퍼라 "비어있음"이
 * 존재하지 않는 위젯이라 1을 그대로 둔다.
 */
type IntakeDraft = {
  birthDate: string;
  previousAnnualIncome: number | null;
  currentAnnualIncome: number | null;
  region: string;
  regionProvinceCode: string;
  regionDistrictCode: string;
  householdSize: number;
  maritalStatus: RoadmapRequest["maritalStatus"] | null;
  employed: boolean | null;
  employmentType: string | null;
  isSmeEmployee: boolean | null;
  monthlyTakeHome: number | null;
  monthlyBudget: number | null;
  /** 목표 시점은 날짜 대신 "N년 M개월 뒤"로 입력받는다. 제출 시 실제 날짜로 변환한다. */
  targetYears: number | null;
  targetMonths: number | null;
  targetAmount: number | null;
  hasEmergencyFund: boolean | null;
  riskLevel: RoadmapRequest["riskLevel"];
  investmentCap: number | null;
};

const EMPTY_DRAFT: IntakeDraft = {
  birthDate: "", previousAnnualIncome: null, currentAnnualIncome: null,
  region: "서울특별시 · 마포구", regionProvinceCode: "11", regionDistrictCode: "11440",
  householdSize: 1, maritalStatus: null,
  employed: null, employmentType: null, isSmeEmployee: null,
  monthlyTakeHome: null, monthlyBudget: null,
  targetYears: null, targetMonths: null, targetAmount: null, hasEmergencyFund: null,
  riskLevel: null, investmentCap: null,
};

/**
 * 배포 전 개발 편의용 기본값. live 모드(실제 배포)에서는 사용자가 직접
 * 입력해야 하므로 항상 빈 값(`EMPTY_DRAFT`)을 쓰고, 그 외(mock 개발 중)에만
 * 매번 타이핑하지 않도록 필수 항목을 채워서 시작한다.
 */
const DEV_DEFAULT_DRAFT: IntakeDraft = {
  ...EMPTY_DRAFT,
  birthDate: "1997-05-14",
  previousAnnualIncome: 32000000,
  currentAnnualIncome: 36000000,
  maritalStatus: "single",
  employed: true,
  employmentType: "employee",
  isSmeEmployee: false,
  monthlyTakeHome: 2400000,
  monthlyBudget: 500000,
  targetYears: 3,
  targetMonths: 0,
  targetAmount: 20000000,
  hasEmergencyFund: true,
  riskLevel: "balanced",
  investmentCap: 30,
};

const initialDraft: IntakeDraft =
  process.env.NEXT_PUBLIC_API_MODE === "live" ? EMPTY_DRAFT : DEV_DEFAULT_DRAFT;

const MIN_HORIZON_MONTHS = 6;
const MAX_HORIZON_MONTHS = 120;

function horizonMonths(draft: Pick<IntakeDraft, "targetYears" | "targetMonths">): number {
  return (draft.targetYears ?? 0) * 12 + (draft.targetMonths ?? 0);
}

/** 백엔드 `_target_date()`와 동일하게 목표 월의 말일로 날짜를 만든다(round-trip 시 값이 어긋나지 않도록). */
function monthsToTargetDate(months: number, today = new Date()): string {
  const absolute = today.getFullYear() * 12 + today.getMonth() + months;
  const year = Math.floor(absolute / 12);
  const month = absolute % 12; // 0-indexed
  const lastDay = new Date(year, month + 1, 0).getDate();
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

/** 백엔드 `_months()`와 동일하게 연·월 차이만 본다(일자는 무시). */
function targetDateToMonths(targetDate: string, today = new Date()): number {
  const [year, month] = targetDate.split("-").map(Number);
  return (year - today.getFullYear()) * 12 + (month - 1 - today.getMonth());
}

const REQUIRED_FIELD_LABELS: [keyof IntakeDraft, string][] = [
  ["birthDate", "생년월일"],
  ["previousAnnualIncome", "직전년도 연소득"],
  ["currentAnnualIncome", "현재 예상 연소득"],
  ["maritalStatus", "혼인 여부"],
  ["employed", "현재 재직 여부"],
  ["monthlyBudget", "필수지출 제외 월 투입액"],
  ["hasEmergencyFund", "비상자금 보유"],
];

function missingRequiredFields(draft: IntakeDraft): string[] {
  const missing = REQUIRED_FIELD_LABELS
    .filter(([key]) => draft[key] === null || draft[key] === "")
    .map(([, label]) => label);
  if (draft.employed && (!draft.employmentType || draft.isSmeEmployee === null)) {
    missing.push("고용형태·중소기업 재직 여부");
  }
  if (draft.targetYears === null) {
    missing.push("목표 시점");
  } else {
    const total = horizonMonths(draft);
    if (total < MIN_HORIZON_MONTHS || total > MAX_HORIZON_MONTHS) {
      missing.push(`목표 시점(${MIN_HORIZON_MONTHS}개월~${MAX_HORIZON_MONTHS / 12}년 사이로 입력)`);
    }
  }
  return missing;
}

function toRoadmapRequest(draft: IntakeDraft): RoadmapRequest {
  return {
    birthDate: draft.birthDate,
    previousAnnualIncome: draft.previousAnnualIncome!,
    currentAnnualIncome: draft.currentAnnualIncome!,
    region: draft.region,
    regionProvinceCode: draft.regionProvinceCode,
    regionDistrictCode: draft.regionDistrictCode,
    householdSize: draft.householdSize,
    maritalStatus: draft.maritalStatus!,
    employed: draft.employed!,
    employmentType: draft.employmentType,
    isSmeEmployee: draft.isSmeEmployee,
    monthlyTakeHome: draft.monthlyTakeHome,
    monthlyBudget: draft.monthlyBudget!,
    targetDate: monthsToTargetDate(horizonMonths(draft)),
    targetAmount: draft.targetAmount,
    hasEmergencyFund: draft.hasEmergencyFund!,
    riskLevel: draft.riskLevel,
    investmentCap: draft.investmentCap,
  };
}

function requestToDraft(request: RoadmapRequest): IntakeDraft {
  const total = targetDateToMonths(request.targetDate);
  return {
    ...request,
    targetYears: Math.floor(total / 12),
    targetMonths: total % 12,
  };
}

const won = (value?: number) => value == null ? "-" : `${Math.round(value).toLocaleString("ko-KR")}원`;

export function RoadmapExperience() {
  const [draft, setDraft] = useState(initialDraft);
  const [request, setRequest] = useState<RoadmapRequest | null>(null);
  const [result, setResult] = useState<RoadmapResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: "agent" | "user"; text: string }[]>([]);
  const [message, setMessage] = useState("");
  const [threadId, setThreadId] = useState(() => crypto.randomUUID());

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(null);
    const missing = missingRequiredFields(draft);
    if (missing.length) {
      setError(`다음 필수 항목을 입력해 주세요: ${missing.join(", ")}`);
      return;
    }
    const nextRequest = toRoadmapRequest(draft);
    setLoading(true);
    try {
      const next = await createRoadmap(nextRequest);
      setRequest(nextRequest);
      setResult(next);
      setMessages([]);
      setThreadId(crypto.randomUUID());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "로드맵을 만들지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!message.trim() || !request) return;
    const userText = message.trim();
    setMessages((current) => [...current, { role: "user", text: userText }]); setMessage("");
    const matched = userText.match(/(\d+)\s*만\s*원/);
    const updatedRequest = matched && /월|저축|투입/.test(userText)
      ? { ...request, monthlyBudget: Number(matched[1]) * 10000 }
      : request;
    if (updatedRequest !== request) setRequest(updatedRequest);
    setLoading(true);
    try {
      const next = await createRoadmap(updatedRequest, userText, threadId);
      if (next.requestPatch) {
        setRequest((current) => current && ({ ...current, ...next.requestPatch }));
      }
      setResult(next);
      setMessages((current) => [...current, {
        role: "agent",
        text: next.chatReply ?? "AI 답변을 생성하지 못했습니다. 백엔드의 Gemini 설정과 로그를 확인해 주세요.",
      }]);
    } catch (cause) {
      setMessages((current) => [...current, {
        role: "agent",
        text: cause instanceof Error ? cause.message : "답변을 생성하지 못했습니다.",
      }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell">
      {result ? (
        <Results
          result={result} loading={loading} messages={messages} message={message}
          setMessage={setMessage} sendMessage={sendMessage}
          onEdit={() => { if (request) setDraft(requestToDraft(request)); setResult(null); }}
        />
      ) : (
        <Intake draft={draft} setDraft={setDraft} submit={submit} loading={loading} error={error} />
      )}
    </div>
  );
}

function Intake({ draft, setDraft, submit, loading, error }: { draft: IntakeDraft; setDraft: (value: IntakeDraft) => void; submit: (e: FormEvent) => void; loading: boolean; error: string | null }) {
  const update = <K extends keyof IntakeDraft>(key: K, value: IntakeDraft[K]) => setDraft({ ...draft, [key]: value });
  return <main className="intake-page">
    <section className="intro"><div className="step-label"><Sparkles size={15} /> 맞춤 로드맵 시작하기</div><h1>당신에게 맞는<br /><span>금융 경로</span>를 찾아볼게요</h1><p>기본 조건을 알려주시면 정책 혜택부터 적금, 투자까지<br />검증 가능한 데이터로 한 번에 비교해 드려요.</p><div className="trust-row"><span><ShieldCheck size={17} /> 입력 정보는 저장하지 않아요</span><span><Target size={17} /> 약 2분 소요</span></div></section>
    <form className="intake-panel" onSubmit={submit}>
      <div className="panel-head"><div><span>STEP 1 OF 3</span><h2>기본 정보를 알려주세요</h2></div><strong>33%</strong></div><div className="progress"><i /></div>
      <div className="form-grid">
        <Field label="생년월일 *" icon={<CalendarDays size={17} />}><SegmentedDateInput value={draft.birthDate} onChange={(v) => update("birthDate", v)} /></Field>
        <Field label="직전년도 연소득 *" hint="세전·과세자료 기준"><div className="suffix-input"><input type="number" placeholder="입력해 주세요" value={draft.previousAnnualIncome === null ? "" : draft.previousAnnualIncome / 10000} onChange={(e) => update("previousAnnualIncome", e.target.value ? Number(e.target.value) * 10000 : null)} required /><span>만원</span></div></Field>
        <Field label="현재 예상 연소득 *" hint="올해 세전 예상"><div className="suffix-input"><input type="number" placeholder="입력해 주세요" value={draft.currentAnnualIncome === null ? "" : draft.currentAnnualIncome / 10000} onChange={(e) => update("currentAnnualIncome", e.target.value ? Number(e.target.value) * 10000 : null)} required /><span>만원</span></div></Field>
        <Field label="거주지역 *" wide><button type="button" className="select-like">{draft.region}<ChevronDown size={17} /></button></Field>
        <Field label="가구원 수 *"><div className="stepper"><button type="button" onClick={() => update("householdSize", Math.max(1, draft.householdSize - 1))}>−</button><strong>{draft.householdSize}명</strong><button type="button" onClick={() => update("householdSize", draft.householdSize + 1)}>＋</button></div></Field>
        <Field label="혼인 여부 *"><Segment value={String(draft.maritalStatus)} options={[['single','미혼'],['married','기혼']]} onChange={(v) => update("maritalStatus", v as RoadmapRequest["maritalStatus"])} /></Field>
        <Field label="현재 재직 중인가요? *"><Segment value={String(draft.employed)} options={[["true","예"],["false","아니오"]]} onChange={(v) => setDraft({ ...draft, employed: v === "true", ...(v === "false" ? { employmentType: null, isSmeEmployee: null } : {}) })} /></Field>
        {draft.employed && <Field label="고용형태 *"><select required value={draft.employmentType ?? ""} onChange={(e) => update("employmentType", e.target.value || null)}><option value="">선택해 주세요</option><option value="employee">정규직·근로자</option><option value="contract">계약직</option><option value="freelancer">프리랜서</option><option value="self_employed">사업자</option></select></Field>}
        {draft.employed && <Field label="중소기업 재직 여부 *"><Segment value={String(draft.isSmeEmployee)} options={[["true","예"],["false","아니오"]]} onChange={(v) => update("isSmeEmployee", v === "true")} /></Field>}
        <Field label="필수지출 제외 월 투입액 *"><div className="suffix-input"><input type="number" step="10000" placeholder="입력해 주세요" value={draft.monthlyBudget ?? ""} onChange={(e) => update("monthlyBudget", e.target.value ? Number(e.target.value) : null)} required /><span>원</span></div></Field>
        <Field label="목표 시점 *" hint={`${MIN_HORIZON_MONTHS}개월~${MAX_HORIZON_MONTHS / 12}년`}>
          <div className="duration-input">
            <div className="suffix-input"><input type="number" min={0} max={MAX_HORIZON_MONTHS / 12} placeholder="입력해 주세요" value={draft.targetYears ?? ""} onChange={(e) => update("targetYears", e.target.value ? Number(e.target.value) : null)} required /><span>년</span></div>
            <div className="suffix-input"><input type="number" min={0} max={11} placeholder="0" value={draft.targetMonths ?? ""} onChange={(e) => update("targetMonths", e.target.value ? Number(e.target.value) : null)} /><span>개월</span></div>
          </div>
        </Field>
        <Field label="비상자금 보유 *"><Segment value={String(draft.hasEmergencyFund)} options={[["true","예"],["false","아니오"]]} onChange={(v) => update("hasEmergencyFund", v === "true")} /></Field>
      </div>
      <details className="detail-fields" open>
        <summary><span><strong>선택·세부 항목</strong><small>추천 정확도를 높여요</small></span><ChevronDown size={18} /></summary>
        <div className="form-grid detail-grid">
          <Field label="월 실수령액" hint="선택"><div className="suffix-input"><input type="number" step="10000" value={draft.monthlyTakeHome ?? ""} placeholder="입력하지 않음" onChange={(e) => update("monthlyTakeHome", e.target.value ? Number(e.target.value) : null)} /><span>원</span></div></Field>
          <Field label="목표금액" hint="선택"><div className="suffix-input"><input type="number" step="1000000" value={draft.targetAmount ?? ""} placeholder="입력하지 않음" onChange={(e) => update("targetAmount", e.target.value ? Number(e.target.value) : null)} /><span>원</span></div></Field>
          <Field label="투자성향" hint="선택"><select value={draft.riskLevel ?? ""} onChange={(e) => update("riskLevel", (e.target.value || null) as RoadmapRequest["riskLevel"])}><option value="">입력하지 않음</option><option value="stable">안정형</option><option value="balanced">균형형</option><option value="growth">성장형</option></select></Field>
          <Field label={`투자상품 최대 배분 · ${draft.investmentCap === null ? "입력하지 않음" : `${draft.investmentCap}%`}`} hint="선택" wide><input className="range-input" type="range" min="0" max="100" step="5" value={draft.investmentCap ?? 0} onPointerDown={() => draft.investmentCap === null && update("investmentCap", 0)} onKeyDown={() => draft.investmentCap === null && update("investmentCap", 0)} onChange={(e) => update("investmentCap", Number(e.target.value))} /></Field>
        </div>
      </details>
      <label className="confirm"><span className="fake-check"><Check size={14} /></span><span>필수지출과 생활비를 제외하고 매달 꾸준히 모을 수 있는 금액이에요.</span></label>
      {error && <div className="form-error"><CircleAlert size={16} />{error}</div>}
      <button className="primary-action" disabled={loading}>{loading ? <><span className="spinner" /> 로드맵을 계산하고 있어요</> : <>로드맵 만들기 <ArrowRight size={18} /></>}</button>
      <p className="form-note">입력값은 추천 계산에만 사용되며 서버에 영구 저장되지 않습니다.</p>
    </form>
  </main>;
}

function Field({ label, hint, wide, icon, children }: { label: string; hint?: string; wide?: boolean; icon?: React.ReactNode; children: React.ReactNode }) {
  return <label className={`field ${wide ? "wide" : ""}`}><span className="field-label">{icon}{label}{hint && <small>{hint}</small>}</span>{children}</label>;
}
function Segment({ value, options, onChange }: { value: string; options: string[][]; onChange: (v: string) => void }) {
  return <div className="segment">{options.map(([key, label]) => <button type="button" key={key} className={value === key ? "selected" : ""} onClick={() => onChange(key)}>{label}</button>)}</div>;
}

/**
 * "yyyy-mm-dd" 문자열을 연/월/일 3칸으로 나눠 입력받는다. 연도 4자리를 다 채우면
 * 월 칸으로, 월 2자리를 다 채우면 일 칸으로 자동으로 포커스를 넘긴다.
 * `value`가 바깥에서 바뀌면(예: 조건 수정 진입 시 기존 값 프리필) 렌더 중 로컬
 * 상태를 다시 맞춘다 — React의 "prop 변경 시 상태 조정" 패턴.
 */
function SegmentedDateInput({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const [prevValue, setPrevValue] = useState(value);
  const [year, setYear] = useState(value.slice(0, 4));
  const [month, setMonth] = useState(value.slice(5, 7));
  const [day, setDay] = useState(value.slice(8, 10));
  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);

  if (value !== prevValue) {
    setPrevValue(value);
    setYear(value.slice(0, 4));
    setMonth(value.slice(5, 7));
    setDay(value.slice(8, 10));
  }

  const commit = (y: string, m: string, d: string) => {
    onChange(y.length === 4 && m.length > 0 && d.length > 0 ? `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` : "");
  };

  return <div className="segmented-date">
    <input
      ref={yearRef} className="year" type="text" inputMode="numeric" placeholder="YYYY" maxLength={4}
      value={year} required
      onChange={(e) => {
        const next = e.target.value.replace(/\D/g, "").slice(0, 4);
        setYear(next); commit(next, month, day);
        if (next.length === 4) monthRef.current?.focus();
      }}
    />
    <span>-</span>
    <input
      ref={monthRef} className="month" type="text" inputMode="numeric" placeholder="MM" maxLength={2}
      value={month}
      onChange={(e) => {
        const next = e.target.value.replace(/\D/g, "").slice(0, 2);
        setMonth(next); commit(year, next, day);
        if (next.length === 2) dayRef.current?.focus();
      }}
      onKeyDown={(e) => { if (e.key === "Backspace" && month === "") yearRef.current?.focus(); }}
    />
    <span>-</span>
    <input
      ref={dayRef} className="day" type="text" inputMode="numeric" placeholder="DD" maxLength={2}
      value={day}
      onChange={(e) => {
        const next = e.target.value.replace(/\D/g, "").slice(0, 2);
        setDay(next); commit(year, month, next);
      }}
      onKeyDown={(e) => { if (e.key === "Backspace" && day === "") monthRef.current?.focus(); }}
    />
  </div>;
}

function Results({ result, loading, messages, message, setMessage, sendMessage, onEdit }: { result: RoadmapResponse; loading: boolean; messages: {role:"agent"|"user";text:string}[]; message: string; setMessage: (v:string)=>void; sendMessage: (e:FormEvent)=>void; onEdit:()=>void }) {
  return <main className="result-page">
    <div className="result-title"><div><div className="step-label"><Check size={15} /> 로드맵 분석 완료</div><h1>지금 가장 잘 맞는 금융 경로예요</h1><p>현재 조건으로 상품과 정책을 다시 비교한 결과입니다.</p></div><button className="secondary-button" onClick={onEdit}><PencilLine size={16} /> 조건 수정</button></div>
    {loading && <div className="recalculating"><span className="spinner dark" /> 변경된 조건으로 전체 후보를 다시 계산하고 있어요.</div>}
    <section className="agent-reason notice"><span className="agent-icon"><ShieldCheck size={21} /></span><div><h2>안내사항</h2><p>{result.notice}</p></div></section>
    <div className="result-body">
      <section className="chat-section"><div className="chat-heading"><span className="agent-icon"><Bot size={21} /></span><div><h2><span>Roadmap Agent와 대화하기</span></h2><p>조건을 바꾸거나 추천 이유를 물어보세요.</p></div><span className="online"><i /> 온라인</span></div><div className="messages">{messages.map((item, index) => <div key={index} className={`message ${item.role}`}><span>{item.text}</span></div>)}</div><form className="chat-form" onSubmit={sendMessage}><input value={message} onChange={(e)=>setMessage(e.target.value)} placeholder="예: 월 저축액을 60만 원으로 바꿔줘" aria-label="로드맵 질문" /><button aria-label="메시지 보내기"><Send size={18} /></button></form><div className="suggestions"><button onClick={()=>setMessage("왜 이 상품을 추천했어?")}>왜 이 상품이 좋아?</button><button onClick={()=>setMessage("월 저축액을 60만 원으로 바꿔줘")}>월 60만 원으로 변경</button><button onClick={()=>setMessage("위험을 더 줄여줘")}>위험을 더 줄이기</button></div></section>
      <section className="scenario-grid"><ScenarioCard scenario={result.recommended} aiReason={result.recommendedReason} primary /><ScenarioCard scenario={result.alternative} aiReason={result.alternativeReason} /></section>
    </div>
  </main>;
}

function ScenarioCard({ scenario, aiReason, primary }: { scenario: Scenario; aiReason: string | null; primary?: boolean }) {
  const total = scenario.allocations.reduce((sum, item) => sum + item.amount, 0);
  const gradient = useMemo(() => { let cursor = 0; return `conic-gradient(${scenario.allocations.map((item) => { const start = cursor; cursor += item.amount / total * 100; return `${item.color} ${start}% ${cursor}%`; }).join(",")})`; }, [scenario.allocations, total]);
  return <article className={`scenario-card ${primary ? "primary" : ""}`}><div className="card-top"><span className="recommend-badge">{primary && <Sparkles size={13} />}{scenario.badge}</span><span className="product-type">{scenario.productType}</span></div><h2>{scenario.title}</h2><p className="data-status"><ShieldCheck size={15} /> 확인된 상품·정책 데이터를 사용했어요</p><div className="metrics"><div><span>원금</span><strong>{won(scenario.principal)}</strong></div><div><span>추천 비교 예상액</span><strong>{won(scenario.expectedAmount)}</strong></div><div><span>목표 달성률</span><strong>{scenario.goalRate == null ? "-" : `${scenario.goalRate.toFixed(1)}%`}</strong></div><div><span>부족액</span><strong>{won(scenario.shortfall)}</strong></div></div><div className="allocation"><div className="donut" style={{ background: gradient }}><span>{won(total).replace("원","")}<small>월 배분</small></span></div><div className="legend">{scenario.allocations.map((item) => <div key={item.label}><i style={{background:item.color}} /><span>{item.label}</span><strong>{won(item.amount)}</strong><small>{Math.round(item.amount/total*100)}%</small></div>)}</div></div><div className="reason"><h3><TrendingUp size={17} /> 안내사항</h3>{scenario.highlights.map((text)=><p key={text}><Check size={14} />{text}</p>)}</div>{aiReason && <div className="ai-card-reason"><h3><Bot size={17} /> AI 추천 이유</h3><p>{aiReason}</p></div>}<div className="warning"><CircleAlert size={17} /><span>{scenario.warnings[0]}</span></div><a className="evidence" href={scenario.evidence[0].url || undefined} target="_blank" rel="noreferrer"><span><small>공식 근거</small>{scenario.evidence[0].title} · {scenario.evidence[0].organization}</span><ExternalLink size={16} /></a></article>;
}
