"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  ArrowRight, Bot, CalendarDays, Check, ChevronDown, CircleAlert,
  ExternalLink, PencilLine, Send, ShieldCheck, Sparkles, Target, TrendingUp,
} from "lucide-react";
import { createRoadmap } from "@/services/roadmapApi";
import type { RoadmapRequest, RoadmapResponse, Scenario } from "@/types/api";

const initialForm: RoadmapRequest = {
  birthDate: "1998-01-01", previousAnnualIncome: 40000000, currentAnnualIncome: 42000000,
  region: "서울특별시 · 마포구", regionProvinceCode: "11", regionDistrictCode: "11440",
  householdSize: 1, maritalStatus: "single",
  employed: true, employmentType: null, isSmeEmployee: null,
  monthlyTakeHome: null, monthlyBudget: 800000,
  targetDate: "2029-08-01", targetAmount: null, hasEmergencyFund: true,
  riskLevel: null, investmentCap: null,
};

const won = (value?: number) => value == null ? "-" : `${Math.round(value).toLocaleString("ko-KR")}원`;

export function RoadmapExperience() {
  const [form, setForm] = useState(initialForm);
  const [result, setResult] = useState<RoadmapResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: "agent" | "user"; text: string }[]>([]);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(null);
    if (form.employed && (!form.employmentType || form.isSmeEmployee === null)) {
      setError("재직 중인 경우 고용형태와 중소기업 재직 여부를 모두 선택해 주세요.");
      return;
    }
    if (!form.riskLevel || form.investmentCap === null) {
      setError("투자성향과 투자상품 최대 배분 비율을 모두 선택해 주세요.");
      return;
    }
    setLoading(true);
    try {
      const next = await createRoadmap(form);
      setResult(next);
      setMessages([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "로드맵을 만들지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;
    const userText = message.trim();
    setMessages((current) => [...current, { role: "user", text: userText }]); setMessage("");
    const matched = userText.match(/(\d+)\s*만\s*원/);
    const updatedForm = matched && /월|저축|투입/.test(userText)
      ? { ...form, monthlyBudget: Number(matched[1]) * 10000 }
      : form;
    if (updatedForm !== form) setForm(updatedForm);
    setLoading(true);
    try {
      const next = await createRoadmap(updatedForm, userText);
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
        <Results result={result} loading={loading} messages={messages} message={message} setMessage={setMessage} sendMessage={sendMessage} onEdit={() => setResult(null)} />
      ) : (
        <Intake form={form} setForm={setForm} submit={submit} loading={loading} error={error} />
      )}
    </div>
  );
}

function Intake({ form, setForm, submit, loading, error }: { form: RoadmapRequest; setForm: (value: RoadmapRequest) => void; submit: (e: FormEvent) => void; loading: boolean; error: string | null }) {
  const update = <K extends keyof RoadmapRequest>(key: K, value: RoadmapRequest[K]) => setForm({ ...form, [key]: value });
  return <main className="intake-page">
    <section className="intro"><div className="step-label"><Sparkles size={15} /> 맞춤 로드맵 시작하기</div><h1>당신에게 맞는<br /><span>금융 경로</span>를 찾아볼게요</h1><p>기본 조건을 알려주시면 정책 혜택부터 적금, 투자까지<br />검증 가능한 데이터로 한 번에 비교해 드려요.</p><div className="trust-row"><span><ShieldCheck size={17} /> 입력 정보는 저장하지 않아요</span><span><Target size={17} /> 약 2분 소요</span></div></section>
    <form className="intake-panel" onSubmit={submit}>
      <div className="panel-head"><div><span>STEP 1 OF 3</span><h2>기본 정보를 알려주세요</h2></div><strong>33%</strong></div><div className="progress"><i /></div>
      <div className="form-grid">
        <Field label="생년월일" icon={<CalendarDays size={17} />}><input type="date" value={form.birthDate} onChange={(e) => update("birthDate", e.target.value)} required /></Field>
        <Field label="직전년도 연소득" hint="세전·과세자료 기준"><div className="suffix-input"><input type="number" value={form.previousAnnualIncome / 10000} onChange={(e) => update("previousAnnualIncome", Number(e.target.value) * 10000)} /><span>만원</span></div></Field>
        <Field label="현재 예상 연소득" hint="올해 세전 예상"><div className="suffix-input"><input type="number" value={form.currentAnnualIncome / 10000} onChange={(e) => update("currentAnnualIncome", Number(e.target.value) * 10000)} /><span>만원</span></div></Field>
        <Field label="거주지역" wide><button type="button" className="select-like">{form.region}<ChevronDown size={17} /></button></Field>
        <Field label="가구원 수"><div className="stepper"><button type="button" onClick={() => update("householdSize", Math.max(1, form.householdSize - 1))}>−</button><strong>{form.householdSize}명</strong><button type="button" onClick={() => update("householdSize", form.householdSize + 1)}>＋</button></div></Field>
        <Field label="혼인 여부"><Segment value={form.maritalStatus} options={[['single','미혼'],['married','기혼']]} onChange={(v) => update("maritalStatus", v as RoadmapRequest["maritalStatus"])} /></Field>
        <Field label="현재 재직 중인가요?"><Segment value={String(form.employed)} options={[["true","예"],["false","아니오"]]} onChange={(v) => setForm({ ...form, employed: v === "true", ...(v === "false" ? { employmentType: null, isSmeEmployee: null } : {}) })} /></Field>
        <Field label="필수지출 제외 월 투입액"><div className="suffix-input"><input type="number" step="10000" value={form.monthlyBudget} onChange={(e) => update("monthlyBudget", Number(e.target.value))} /><span>원</span></div></Field>
      </div>
      <details className="detail-fields" open>
        <summary><span><strong>선택·세부 항목</strong><small>추천 정확도를 높여요</small></span><ChevronDown size={18} /></summary>
        <div className="form-grid detail-grid">
          {form.employed && <Field label="고용형태 *"><select required value={form.employmentType ?? ""} onChange={(e) => update("employmentType", e.target.value || null)}><option value="">선택해 주세요</option><option value="employee">정규직·근로자</option><option value="contract">계약직</option><option value="freelancer">프리랜서</option><option value="self_employed">사업자</option></select></Field>}
          {form.employed && <Field label="중소기업 재직 여부 *"><Segment value={String(form.isSmeEmployee)} options={[["true","예"],["false","아니오"]]} onChange={(v) => update("isSmeEmployee", v === "true")} /></Field>}
          <Field label="월 실수령액" hint="선택"><div className="suffix-input"><input type="number" step="10000" value={form.monthlyTakeHome ?? ""} placeholder="입력하지 않음" onChange={(e) => update("monthlyTakeHome", e.target.value ? Number(e.target.value) : null)} /><span>원</span></div></Field>
          <Field label="목표금액" hint="선택"><div className="suffix-input"><input type="number" step="1000000" value={form.targetAmount ?? ""} placeholder="입력하지 않음" onChange={(e) => update("targetAmount", e.target.value ? Number(e.target.value) : null)} /><span>원</span></div></Field>
          <Field label="목표 시점"><input type="date" value={form.targetDate} onChange={(e) => update("targetDate", e.target.value)} required /></Field>
          <Field label="비상자금 보유"><Segment value={String(form.hasEmergencyFund)} options={[["true","예"],["false","아니오"]]} onChange={(v) => update("hasEmergencyFund", v === "true")} /></Field>
          <Field label="투자성향 *"><select required value={form.riskLevel ?? ""} onChange={(e) => update("riskLevel", (e.target.value || null) as RoadmapRequest["riskLevel"])}><option value="">선택해 주세요</option><option value="stable">안정형</option><option value="balanced">균형형</option><option value="growth">성장형</option></select></Field>
          <Field label={`투자상품 최대 배분 * · ${form.investmentCap === null ? "선택 필요" : `${form.investmentCap}%`}`} wide><input className="range-input" type="range" min="0" max="100" step="5" value={form.investmentCap ?? 0} onPointerDown={() => form.investmentCap === null && update("investmentCap", 0)} onKeyDown={() => form.investmentCap === null && update("investmentCap", 0)} onChange={(e) => update("investmentCap", Number(e.target.value))} /></Field>
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

function Results({ result, loading, messages, message, setMessage, sendMessage, onEdit }: { result: RoadmapResponse; loading: boolean; messages: {role:"agent"|"user";text:string}[]; message: string; setMessage: (v:string)=>void; sendMessage: (e:FormEvent)=>void; onEdit:()=>void }) {
  return <main className="result-page">
    <div className="result-title"><div><div className="step-label"><Check size={15} /> 로드맵 분석 완료</div><h1>지금 가장 잘 맞는 금융 경로예요</h1><p>현재 조건으로 상품과 정책을 다시 비교한 결과입니다.</p></div><button className="secondary-button" onClick={onEdit}><PencilLine size={16} /> 조건 수정</button></div>
    {loading && <div className="recalculating"><span className="spinner dark" /> 변경된 조건으로 전체 후보를 다시 계산하고 있어요.</div>}
    <section className="agent-reason notice"><span className="agent-icon"><ShieldCheck size={21} /></span><div><h2>안내사항</h2><p>{result.notice}</p></div></section>
    <section className="scenario-grid"><ScenarioCard scenario={result.recommended} aiReason={result.recommendedReason} primary /><ScenarioCard scenario={result.alternative} aiReason={result.alternativeReason} /></section>
    <section className="chat-section"><div className="chat-heading"><span className="agent-icon"><Bot size={21} /></span><div><h2>Roadmap Agent와 대화하기</h2><p>조건을 바꾸거나 추천 이유를 물어보세요.</p></div><span className="online"><i /> 온라인</span></div><div className="messages">{messages.map((item, index) => <div key={index} className={`message ${item.role}`}><span>{item.text}</span></div>)}</div><form className="chat-form" onSubmit={sendMessage}><input value={message} onChange={(e)=>setMessage(e.target.value)} placeholder="예: 월 저축액을 60만 원으로 바꿔줘" aria-label="로드맵 질문" /><button aria-label="메시지 보내기"><Send size={18} /></button></form><div className="suggestions"><button onClick={()=>setMessage("왜 이 상품을 추천했어?")}>왜 이 상품이 좋아?</button><button onClick={()=>setMessage("월 저축액을 60만 원으로 바꿔줘")}>월 60만 원으로 변경</button><button onClick={()=>setMessage("위험을 더 줄여줘")}>위험을 더 줄이기</button></div></section>
  </main>;
}

function ScenarioCard({ scenario, aiReason, primary }: { scenario: Scenario; aiReason: string | null; primary?: boolean }) {
  const total = scenario.allocations.reduce((sum, item) => sum + item.amount, 0);
  const gradient = useMemo(() => { let cursor = 0; return `conic-gradient(${scenario.allocations.map((item) => { const start = cursor; cursor += item.amount / total * 100; return `${item.color} ${start}% ${cursor}%`; }).join(",")})`; }, [scenario.allocations, total]);
  return <article className={`scenario-card ${primary ? "primary" : ""}`}><div className="card-top"><span className="recommend-badge">{primary && <Sparkles size={13} />}{scenario.badge}</span><span className="product-type">{scenario.productType}</span></div><h2>{scenario.title}</h2><p className="data-status"><ShieldCheck size={15} /> 확인된 상품·정책 데이터를 사용했어요</p><div className="metrics"><div><span>원금</span><strong>{won(scenario.principal)}</strong></div><div><span>추천 비교 예상액</span><strong>{won(scenario.expectedAmount)}</strong></div><div><span>목표 달성률</span><strong>{scenario.goalRate == null ? "-" : `${scenario.goalRate.toFixed(1)}%`}</strong></div><div><span>부족액</span><strong>{won(scenario.shortfall)}</strong></div></div><div className="allocation"><div className="donut" style={{ background: gradient }}><span>{won(total).replace("원","")}<small>월 배분</small></span></div><div className="legend">{scenario.allocations.map((item) => <div key={item.label}><i style={{background:item.color}} /><span>{item.label}</span><strong>{won(item.amount)}</strong><small>{Math.round(item.amount/total*100)}%</small></div>)}</div></div><div className="reason"><h3><TrendingUp size={17} /> 안내사항</h3>{scenario.highlights.map((text)=><p key={text}><Check size={14} />{text}</p>)}</div>{aiReason && <div className="ai-card-reason"><h3><Bot size={17} /> AI 추천 이유</h3><p>{aiReason}</p></div>}<div className="warning"><CircleAlert size={17} /><span>{scenario.warnings[0]}</span></div><a className="evidence" href={scenario.evidence[0].url || undefined} target="_blank" rel="noreferrer"><span><small>공식 근거</small>{scenario.evidence[0].title} · {scenario.evidence[0].organization}</span><ExternalLink size={16} /></a></article>;
}
