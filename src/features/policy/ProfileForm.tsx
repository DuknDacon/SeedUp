/**
 * 프로필 입력 폼.
 * BenefitUp-Agent 문서 §5 스키마 필드 그대로.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  EmploymentType,
  HousingStatus,
  InterestCategory,
  MarriageStatus,
  UserProfile,
} from "@/types/api";
import { saveProfile, loadProfile } from "@/lib/profileStorage";

const EMPLOYMENT_TYPES: EmploymentType[] = [
  "근로자",
  "사업자",
  "연금소득자",
  "채무조정자",
  "무직",
  "학생",
];
const MARRIAGE: { value: MarriageStatus; label: string }[] = [
  { value: "single", label: "미혼" },
  { value: "married", label: "기혼" },
  { value: "any", label: "선택 안 함" },
];
const HOUSING: { value: HousingStatus; label: string }[] = [
  { value: "with_parents", label: "부모님과 거주" },
  { value: "rental", label: "월세" },
  { value: "monthly", label: "반전세" },
  { value: "jeonse", label: "전세" },
  { value: "own", label: "자가" },
];
const INTERESTS: InterestCategory[] = [
  "주거",
  "창업",
  "취업",
  "교육",
  "결혼",
  "비상금",
  "노후준비",
];

export function ProfileForm() {
  const router = useRouter();
  const initial = loadProfile();

  const [age, setAge] = useState<string>(String(initial?.age ?? 27));
  const [income, setIncome] = useState<string>(
    initial?.annualIncomeKrw ? String(initial.annualIncomeKrw / 10_000) : "3000",
  );
  const [credit, setCredit] = useState<string>(
    initial?.creditScore ? String(initial.creditScore) : "",
  );
  const [regionCode, setRegionCode] = useState<string>(
    initial?.regionCode ?? "11110",
  );
  const [employment, setEmployment] = useState<EmploymentType>(
    initial?.employmentType ?? "근로자",
  );
  const [marriage, setMarriage] = useState<MarriageStatus>(
    initial?.marriageStatus ?? "single",
  );
  const [housing, setHousing] = useState<HousingStatus>(
    initial?.housingStatus ?? "rental",
  );
  const [interests, setInterests] = useState<InterestCategory[]>(
    initial?.interests ?? ["주거", "비상금"],
  );
  const [freeText, setFreeText] = useState<string>(
    initial?.freeTextQuery ?? "",
  );

  function toggleInterest(i: InterestCategory) {
    setInterests((cur) =>
      cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i],
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const profile: UserProfile = {
      age: Number(age),
      annualIncomeKrw: income ? Number(income) * 10_000 : null,
      creditScore: credit ? Number(credit) : null,
      regionCode,
      employmentType: employment,
      marriageStatus: marriage,
      housingStatus: housing,
      interests,
      freeTextQuery: freeText || null,
    };
    saveProfile(profile);
    router.push("/policy");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Section title="기본 정보">
        <Field label="나이">
          <input
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            min={15}
            max={70}
            className="input"
            required
          />
        </Field>
        <Field label="연 소득 (만원)" hint="세전 기준, 모르면 비워두세요">
          <input
            type="number"
            value={income}
            onChange={(e) => setIncome(e.target.value)}
            className="input"
            placeholder="예: 3000"
          />
        </Field>
        <Field label="신용점수 (KCB, 선택)">
          <input
            type="number"
            value={credit}
            onChange={(e) => setCredit(e.target.value)}
            min={0}
            max={1000}
            className="input"
            placeholder="예: 780"
          />
        </Field>
        <Field
          label="거주지 (법정동 코드)"
          hint="추후 지역 셀렉트로 교체 예정. 지금은 코드 입력."
        >
          <input
            type="text"
            value={regionCode}
            onChange={(e) => setRegionCode(e.target.value)}
            className="input"
            placeholder="예: 11110 (서울 종로구)"
          />
        </Field>
      </Section>

      <Section title="상황">
        <Field label="고용 형태">
          <select
            value={employment}
            onChange={(e) => setEmployment(e.target.value as EmploymentType)}
            className="input"
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
            onChange={(e) => setMarriage(e.target.value as MarriageStatus)}
            className="input"
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
            className="input"
          >
            {HOUSING.map((h) => (
              <option key={h.value} value={h.value}>
                {h.label}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="관심 목표 (복수 선택)">
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((i) => {
            const on = interests.includes(i);
            return (
              <button
                type="button"
                key={i}
                onClick={() => toggleInterest(i)}
                className={`px-3 py-1.5 rounded-full text-sm border transition ${
                  on
                    ? "bg-brand-600 border-brand-600 text-white"
                    : "bg-white border-slate-300 text-slate-700 hover:border-brand-500"
                }`}
              >
                {i}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="자유 질문 (선택)">
        <textarea
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          className="input min-h-[80px]"
          placeholder="예: 서울에서 전세 이사 준비 중인데 도움되는 정책이 있을까요?"
        />
      </Section>

      <button
        type="submit"
        className="w-full py-3 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 transition"
      >
        내게 맞는 정책 찾기 →
      </button>

      <style jsx>{`
        .input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid #cbd5e1;
          border-radius: 0.5rem;
          background: white;
        }
        .input:focus {
          outline: 2px solid #3b82f6;
          outline-offset: 1px;
          border-color: transparent;
        }
      `}</style>
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <h3 className="font-semibold mb-3 text-slate-800">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
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
      <div className="text-sm font-medium text-slate-700 mb-1">{label}</div>
      {children}
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </label>
  );
}
