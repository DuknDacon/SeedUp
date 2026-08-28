/**
 * 통합 상담(/chat) 진입 시점에 한 번에 받는 프로필 폼.
 *
 * 기능①(정책 매칭)과 기능②(자산관리 로드맵) 어느 쪽 질문이 먼저 나올지 모르는
 * 통합 상담이라, 이 폼은 두 에이전트가 요구하는 필드를 모두 입력받는다. 다만
 * "폼을 다시 열지 여부"를 결정하는 `isIntegratedProfileComplete`는 기능① 필드만
 * 필수로 본다 — 기능② 전용 필드(월 저축여력/목표 시점 등)가 비어 있어도 대화는
 * 바로 시작하고, 부족한 값은 로드맵 첫 호출의 `profile_ask` 응답으로 오른쪽
 * 결과 패널에서 이어서 채운다 (아래 함수 docstring 참고).
 *
 * 저장은 localStorage(seedup:profile) 로 통일. "조건 재입력"으로 다시 열 때는
 * initial 로 기존 값을 채워 넣는다.
 */
"use client";

import { useState } from "react";
import { Check, Landmark, TrendingUp, UserRound } from "lucide-react";
import type {
  EmploymentType,
  HousingStatus,
  MaritalStatus,
  UserProfile,
} from "@/types/api";
import { RegionSearchSelect } from "./RegionSearchSelect";

const EMPLOYMENT_TYPES: EmploymentType[] = [
  "근로자",
  "사업자",
  "연금소득자",
  "채무조정자",
  "무직",
  "학생",
];
const MARRIAGE: { value: MaritalStatus; label: string }[] = [
  { value: "single", label: "미혼" },
  { value: "married", label: "기혼" },
];
const HOUSING: { value: HousingStatus; label: string }[] = [
  { value: "with_parents", label: "부모님과 거주" },
  { value: "rental", label: "월세" },
  { value: "monthly", label: "반전세" },
  { value: "jeonse", label: "전세" },
  { value: "own", label: "자가" },
];

/**
 * 프로필이 통합 상담을 시작하기에 충분한지 검사.
 * 기능①(정책 매칭)이 항상 바로 필요로 하는 최소 필드
 * (birthDate/annualIncome/employment/marital/housing/region)만 필수로 본다.
 *
 * 기능②(로드맵) 전용 필드(monthlyBudget/targetDate/householdSize/
 * hasEmergencyFund 등)는 여기서 막지 않는다 — 첫 로드맵 호출에서 부족하면
 * 백엔드가 `profile_ask` 블록으로 되물어 오른쪽 결과 패널에서 이어서 입력받는다
 * (`ChatWindow.tsx`의 `onProfileAskSubmit` 참고). 그래야 로드맵 필드가 없는
 * 기존 저장 프로필도 폼 재입력 없이 바로 대화를 시작할 수 있다.
 *
 * 기존 온보딩만 거친 유저는 birthDate 대신 age 만 있을 수 있어 age 로도 통과시킨다
 * (birthDate 로 파생 불가한 경우엔 라우터 어댑터가 age 를 그대로 이용).
 */
export function isIntegratedProfileComplete(
  p: UserProfile | null | undefined,
): boolean {
  if (!p) return false;
  const hasBirth = Boolean(p.birthDate) || typeof p.age === "number";
  const hasIncome = p.annualIncomeKrw != null;
  const hasEmployment = Boolean(p.employmentType);
  const hasMarriage = Boolean(p.maritalStatus);
  const hasHousing = Boolean(p.housingStatus);
  const hasRegionName = Boolean(p.region);
  // 기능 2 전용 필드는 여기서 진입을 막지 않는다. 빠진 값은 초기 로드맵
  // 요청의 profile_ask 응답으로 받아 오른쪽 결과 패널에서 이어서 입력한다.
  return (
    hasBirth &&
    hasIncome &&
    hasEmployment &&
    hasMarriage &&
    hasHousing &&
    hasRegionName
  );
}

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function monthsFromToday(value: string): number {
  const [year, month] = value.split("-").map(Number);
  const today = new Date();
  return (year - today.getFullYear()) * 12 + month - (today.getMonth() + 1);
}

export function IntegratedProfileForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: UserProfile | null;
  onSubmit: (profile: UserProfile) => void;
  /** 이미 프로필이 완성돼 있어서 이 폼이 "재입력"인 경우에만 노출. 첫 진입엔 undefined. */
  onCancel?: () => void;
}) {
  // 표시 단위는 "만원"이지만 저장은 원 단위. 폼 상태는 문자열로 다뤄 빈 값과 0 을 구분.
  // TODO(임시): 테스트 편의를 위해 2000년생 + 일반적인 값으로 기본값 채움. 실제 배포 전 제거 검토.
  const [birthDate, setBirthDate] = useState<string>(
    initial?.birthDate ?? "2000-01-01",
  );
  const [incomeManwon, setIncomeManwon] = useState<string>(
    initial?.annualIncomeKrw != null
      ? String(Math.round(initial.annualIncomeKrw / 10_000))
      : "3000",
  );
  const [employment, setEmployment] = useState<EmploymentType>(
    initial?.employmentType ?? "근로자",
  );
  const [marriage, setMarriage] = useState<MaritalStatus>(
    (initial?.maritalStatus as MaritalStatus) ?? "single",
  );
  const [housing, setHousing] = useState<HousingStatus>(
    initial?.housingStatus ?? "rental",
  );
  const [regionCode, setRegionCode] = useState<string>(
    initial?.regionCode ?? initial?.regionDistrictCode ?? "11110",
  );
  const [region, setRegion] = useState<string>(
    initial?.region ?? "서울특별시 종로구",
  );
  const [monthlyBudgetManwon, setMonthlyBudgetManwon] = useState<string>(
    initial?.monthlyBudget != null
      ? String(Math.round(initial.monthlyBudget / 10_000))
      : "50",
  );
  const [targetDate, setTargetDate] = useState<string>(
    initial?.targetDate ?? "2029-12-31",
  );
  const [householdSize, setHouseholdSize] = useState<string>(
    initial?.householdSize != null ? String(initial.householdSize) : "1",
  );
  // 로드맵 필수: 비상자금 보유 여부. "" = 아직 선택 안 함(제출 차단).
  const [hasEmergencyFund, setHasEmergencyFund] = useState<
    "" | "true" | "false"
  >(
    typeof initial?.hasEmergencyFund === "boolean"
      ? String(initial.hasEmergencyFund) as "true" | "false"
      : "false",
  );
  // 로드맵 선택 항목 — 비워두면 각각의 자연스러운 기본값으로 처리됨.
  // TODO(임시): 테스트 편의를 위해 일반적인 값으로 기본값 채움. 실제 배포 전 제거 검토.
  const [previousIncomeManwon, setPreviousIncomeManwon] = useState<string>(
    initial?.previousAnnualIncome != null
      ? String(Math.round(initial.previousAnnualIncome / 10_000))
      : "3000",
  );
  const [isSmeEmployee, setIsSmeEmployee] = useState<"" | "true" | "false">(
    typeof initial?.isSmeEmployee === "boolean"
      ? (String(initial.isSmeEmployee) as "true" | "false")
      : "false",
  );
  const [monthlyTakeHomeManwon, setMonthlyTakeHomeManwon] = useState<string>(
    initial?.monthlyTakeHome != null
      ? String(Math.round(initial.monthlyTakeHome / 10_000))
      : "220",
  );
  const [targetAmountManwon, setTargetAmountManwon] = useState<string>(
    initial?.targetAmount != null
      ? String(Math.round(initial.targetAmount / 10_000))
      : "5000",
  );
  const [riskLevel, setRiskLevel] = useState<
    "" | "stable" | "balanced" | "growth"
  >(initial?.riskLevel ?? "balanced");
  const [investmentCap, setInvestmentCap] = useState<string>(
    initial?.investmentCap != null ? String(initial.investmentCap) : "30",
  );

  const [err, setErr] = useState<string | null>(null);
  // 퀴즈처럼 한 단계씩 진행 — 최종 검증은 그대로 handleSubmit(3단계 제출)에서만 수행.
  const [step, setStep] = useState(0);
  const STEP_META = [
    { title: "기본 정보" },
    { title: "기능① 정책 매칭 조건" },
    { title: "기능② 자산관리 로드맵 조건" },
  ] as const;

  function goNext() {
    setErr(null);
    if (step === 0) {
      if (!isRealDate(birthDate)) return setErr("생년월일을 올바른 날짜로 입력해주세요.");
      if (!region.trim()) return setErr("거주 지역을 검색해서 선택해주세요.");
      if (incomeManwon.trim() === "") return setErr("연 소득을 입력해주세요.");
      if (householdSize.trim() === "") return setErr("가구원 수를 입력해주세요.");
    }
    setStep((s) => Math.min(s + 1, STEP_META.length - 1));
  }

  function goBack() {
    setErr(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  function deriveAge(bd: string): number | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bd)) return null;
    const [y, m, d] = bd.split("-").map(Number);
    const today = new Date();
    let age = today.getFullYear() - y;
    const beforeBirthday =
      today.getMonth() + 1 < m ||
      (today.getMonth() + 1 === m && today.getDate() < d);
    if (beforeBirthday) age -= 1;
    return Math.max(age, 0);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!isRealDate(birthDate)) return setErr("생년월일을 올바른 날짜로 입력해주세요.");
    const age = deriveAge(birthDate);
    if (age == null || age < 14 || age > 100)
      return setErr("생년월일은 만 14세부터 100세 범위로 입력해주세요.");
    if (!region.trim()) return setErr("거주 지역명을 입력해주세요.");
    if (!/^\d{5}$/.test(regionCode.trim()))
      return setErr("거주지 법정동 코드는 숫자 5자리로 입력해주세요.");
    if (!isRealDate(targetDate)) return setErr("목표 시점을 올바른 날짜로 입력해주세요.");
    const targetMonths = monthsFromToday(targetDate);
    if (targetMonths < 6 || targetMonths > 120)
      return setErr("목표 시점은 현재로부터 6개월에서 10년 사이로 입력해주세요.");
    if (hasEmergencyFund === "")
      return setErr("비상자금 보유 여부를 선택해주세요.");
    const income = Number(incomeManwon.replace(/[,_\s]/g, ""));
    if (!Number.isFinite(income) || income < 0)
      return setErr("연 소득을 확인해주세요.");
    const budget = Number(monthlyBudgetManwon.replace(/[,_\s]/g, ""));
    if (!Number.isFinite(budget) || budget <= 0)
      return setErr("월 저축여력을 확인해주세요.");
    const hh = Number(householdSize);
    if (!Number.isInteger(hh) || hh < 1)
      return setErr("가구원 수를 확인해주세요.");

    const optionalWon = (value: string, label: string): number | undefined => {
      if (value.trim() === "") return undefined;
      const parsed = Number(value.replace(/[,_\s]/g, ""));
      if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${label}은 0보다 크게 입력해주세요.`);
      return Math.round(parsed * 10_000);
    };
    let previousIncome: number | undefined;
    let monthlyTakeHome: number | undefined;
    let targetAmount: number | undefined;
    try {
      previousIncome = previousIncomeManwon.trim() === "" ? undefined : Math.round(Number(previousIncomeManwon) * 10_000);
      if (previousIncome != null && (!Number.isFinite(previousIncome) || previousIncome < 0))
        return setErr("직전년도 연 소득은 0 이상으로 입력해주세요.");
      monthlyTakeHome = optionalWon(monthlyTakeHomeManwon, "월 실수령액");
      targetAmount = optionalWon(targetAmountManwon, "목표 금액");
    } catch (cause) {
      return setErr(cause instanceof Error ? cause.message : "선택 입력값을 확인해주세요.");
    }
    const budgetKrw = Math.round(budget * 10_000);
    if (monthlyTakeHome != null && budgetKrw > monthlyTakeHome)
      return setErr("월 저축여력은 월 실수령액보다 클 수 없습니다.");
    const cap = investmentCap.trim() === "" ? null : Number(investmentCap);
    if (cap != null && (!Number.isInteger(cap) || cap < 0 || cap > 100))
      return setErr("투자상품 최대 배분은 0에서 100 사이의 정수로 입력해주세요.");

    // regionCode(5자리 법정동)에서 province(앞 2자리) 도출.
    const districtCode = (regionCode || "11110").trim();
    const provinceCode = districtCode.slice(0, 2) || "11";
    const currentIncomeKrw = Math.round(income * 10_000);

    // 선택 항목은 빈 문자열이면 undefined 로 흘려보내 백엔드/에이전트가 각자의
    // 기본값(예: riskLevel → "balanced")을 적용하게 둔다.
    const toBoolOrUndefined = (v: "" | "true" | "false") =>
      v === "" ? undefined : v === "true";

    const next: UserProfile = {
      ...(initial ?? {}),
      // 정책 매칭용 필드
      age: age ?? initial?.age ?? 27,
      annualIncomeKrw: currentIncomeKrw,
      regionCode: districtCode,
      employmentType: employment,
      maritalStatus: marriage,
      housingStatus: housing,
      // 통합 폼은 interests 를 UI 로 묻지 않는다. 그래서 예전 세션(/policy 폼)에서
      // 남긴 값이 `...initial` 스프레드로 살아남으면 사용자가 이번 상담에서
      // 의도한 적 없는 관심 카테고리가 하위 에이전트 쿼리에 계속 섞이는 문제가
      // 있었다 (BenefitUp SQL WHERE 절이 프로필의 관심 어휘까지 OR 로 얹음).
      // 통합 폼 저장은 곧 "이번 상담의 조건을 재선언" 하는 액션이라, interests
      // 는 매 저장마다 빈 배열로 명시적으로 리셋한다.
      interests: [],
      creditScore: initial?.creditScore ?? null,
      // 로드맵용 필드 (모두 원 단위 / ISO date / 정수)
      birthDate,
      monthlyBudget: budgetKrw,
      targetDate,
      householdSize: hh,
      region: region.trim(),
      regionDistrictCode: districtCode,
      regionProvinceCode: provinceCode,
      hasEmergencyFund: hasEmergencyFund === "true",
      // 현재 연소득은 위 annualIncomeKrw 와 동일 값. 직전년도 소득은 비워두면
      // Roadmap-Agent 쪽에서 현재 소득과 같은 값으로 처리된다(소득 변동 없음 가정).
      currentAnnualIncome: currentIncomeKrw,
      previousAnnualIncome: previousIncome ?? null,
      isSmeEmployee: toBoolOrUndefined(isSmeEmployee) ?? null,
      monthlyTakeHome: monthlyTakeHome ?? null,
      targetAmount: targetAmount ?? null,
      riskLevel: riskLevel || null,
      investmentCap: cap,
      // 통합 상담에서는 온보딩 자유질문 자동 전송을 재사용하지 않는다.
      freeTextQuery: null,
    };
    onSubmit(next);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 진행 표시 — 퀴즈처럼 한 단계씩 */}
      <div className="flex items-center gap-2">
        {STEP_META.map((meta, i) => (
          <div key={meta.title} className="flex-1 flex items-center gap-2">
            <div
              className={`w-7 h-7 flex-shrink-0 rounded-full grid place-items-center text-xs font-bold border-2 ${
                i < step
                  ? "bg-brand-600 border-brand-600 text-white"
                  : i === step
                    ? "border-brand-600 text-brand-700"
                    : "border-slate-200 text-slate-400"
              }`}
            >
              {i < step ? <Check size={13} /> : i + 1}
            </div>
            {i < STEP_META.length - 1 && (
              <div
                className={`flex-1 h-0.5 rounded ${i < step ? "bg-brand-600" : "bg-slate-200"}`}
              />
            )}
          </div>
        ))}
      </div>
      <div className="text-xs font-semibold text-slate-500">
        {step + 1} / {STEP_META.length}단계 · {STEP_META[step].title}
      </div>

      {step === 0 && (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="flex items-center gap-1.5 font-semibold mb-3 text-sm text-slate-800">
          <span className="w-6 h-6 grid place-items-center rounded-md bg-brand-50 text-brand-600">
            <UserRound size={13} />
          </span>
          기본 정보
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
          <Field label="생년월일">
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              required
            />
          </Field>
          <Field
            label="거주 지역"
            hint="시군구명을 검색해서 선택하세요"
          >
            <RegionSearchSelect
              value={region}
              onSelect={({ name, code }) => {
                setRegion(name);
                setRegionCode(code);
              }}
            />
          </Field>
          <Field label="연 소득 (만원)" hint="세전 기준">
            <input
              type="number"
              value={incomeManwon}
              onChange={(e) => setIncomeManwon(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              placeholder="예: 3000"
              min={0}
              required
            />
          </Field>
          <Field label="가구원 수" hint="본인 포함">
            <input
              type="number"
              value={householdSize}
              onChange={(e) => setHouseholdSize(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              min={1}
              required
            />
          </Field>
        </div>
      </div>
      )}

      {step === 1 && (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="flex items-center gap-1.5 font-semibold mb-3 text-sm text-slate-800">
          <span className="w-6 h-6 grid place-items-center rounded-md bg-brand-50 text-brand-600">
            <Landmark size={13} />
          </span>
          기능① 정책 매칭 조건
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-3 gap-y-2">
          <Field label="고용 형태">
            <select
              value={employment}
              onChange={(e) => setEmployment(e.target.value as EmploymentType)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            >
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="혼인 상태">
            <select
              value={marriage}
              onChange={(e) => setMarriage(e.target.value as MaritalStatus)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            >
              {MARRIAGE.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="주거 형태">
            <select
              value={housing}
              onChange={(e) => setHousing(e.target.value as HousingStatus)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            >
              {HOUSING.map((h) => (
                <option key={h.value} value={h.value}>
                  {h.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>
      )}

      {step === 2 && (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="flex items-center gap-1.5 font-semibold mb-3 text-sm text-slate-800">
          <span className="w-6 h-6 grid place-items-center rounded-md bg-sprout-50 text-sprout-600">
            <TrendingUp size={13} />
          </span>
          기능② 자산관리 로드맵 조건
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
          <Field label="월 저축여력 (만원)">
            <input
              type="number"
              value={monthlyBudgetManwon}
              onChange={(e) => setMonthlyBudgetManwon(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              min={1}
              required
            />
          </Field>
          <Field label="목표 시점">
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              required
            />
          </Field>
          <Field label="비상자금 보유 여부">
            <select
              value={hasEmergencyFund}
              onChange={(e) =>
                setHasEmergencyFund(e.target.value as "" | "true" | "false")
              }
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              required
            >
              <option value="" disabled>
                선택해주세요
              </option>
              <option value="true">예</option>
              <option value="false">아니오</option>
            </select>
          </Field>
        </div>

        <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2" open>
          <summary className="text-xs font-semibold text-brand-700 cursor-pointer select-none">
            세부 항목 (선택 — 입력하면 로드맵 정확도가 올라가요)
          </summary>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2 mt-3">
            <Field label="직전년도 연 소득 (만원)" hint="비워두면 위 연 소득과 동일하게 처리">
              <input
                type="number"
                value={previousIncomeManwon}
                onChange={(e) => setPreviousIncomeManwon(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                min={0}
                placeholder="입력하지 않음"
              />
            </Field>
            <Field label="중소기업 재직 여부" hint="재직 중인 경우에만 사용">
              <select
                value={isSmeEmployee}
                onChange={(e) =>
                  setIsSmeEmployee(e.target.value as "" | "true" | "false")
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              >
                <option value="">입력하지 않음</option>
                <option value="true">예</option>
                <option value="false">아니오</option>
              </select>
            </Field>
            <Field label="월 실수령액 (만원)">
              <input
                type="number"
                value={monthlyTakeHomeManwon}
                onChange={(e) => setMonthlyTakeHomeManwon(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                min={0}
                placeholder="입력하지 않음"
              />
            </Field>
            <Field label="목표 금액 (만원)">
              <input
                type="number"
                value={targetAmountManwon}
                onChange={(e) => setTargetAmountManwon(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                min={0}
                placeholder="입력하지 않음"
              />
            </Field>
            <Field label="투자 성향">
              <select
                value={riskLevel}
                onChange={(e) =>
                  setRiskLevel(
                    e.target.value as "" | "stable" | "balanced" | "growth",
                  )
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              >
                <option value="">입력하지 않음</option>
                <option value="stable">안정형</option>
                <option value="balanced">균형형</option>
                <option value="growth">성장형</option>
              </select>
            </Field>
            <Field label="투자상품 최대 배분 (%)">
              <input
                type="number"
                value={investmentCap}
                onChange={(e) => setInvestmentCap(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                min={0}
                max={100}
                placeholder="입력하지 않음"
              />
            </Field>
          </div>
        </details>
      </div>
      )}

      {err && (
        <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">
          {err}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        {step === 0 && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            취소
          </button>
        )}
        {step > 0 && (
          <button
            type="button"
            onClick={goBack}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            ← 이전
          </button>
        )}
        {step < STEP_META.length - 1 ? (
          <button
            type="button"
            onClick={goNext}
            className="px-5 py-2 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700"
          >
            다음 →
          </button>
        ) : (
          <button
            type="submit"
            className="px-5 py-2 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700"
          >
            저장하고 대화 시작 →
          </button>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-slate-700 mb-0.5">{label}</div>
      {children}
      {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
    </label>
  );
}
