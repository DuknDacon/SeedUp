/**
 * 통합 상담 온보딩 폼(3단계)과 채팅 화면의 "현재 조건" 요약이 공유하는
 * 필드 메타데이터. 라벨·enum 값·"어느 단계에 속하는 필드인지"를 한 곳에서만
 * 관리해, 폼의 실시간 요약 카드와 채팅 화면의 조건 재입력(단계 바로가기)이
 * 서로 다른 매핑을 갖지 않도록 한다.
 */
import type {
  EmploymentType,
  HousingStatus,
  MaritalStatus,
  UserProfile,
} from "@/types/api";

export const EMPLOYMENT_TYPES: EmploymentType[] = [
  "근로자",
  "사업자",
  "연금소득자",
  "채무조정자",
  "무직",
  "학생",
];

export const MARRIAGE_OPTIONS: { value: MaritalStatus; label: string }[] = [
  { value: "single", label: "미혼" },
  { value: "married", label: "기혼" },
];

export const HOUSING_OPTIONS: { value: HousingStatus; label: string }[] = [
  { value: "with_parents", label: "부모님과 거주" },
  { value: "rental", label: "월세" },
  { value: "monthly", label: "반전세" },
  { value: "jeonse", label: "전세" },
  { value: "own", label: "자가" },
];

export const RISK_LEVEL_LABELS: Record<string, string> = {
  stable: "안정형",
  balanced: "균형형",
  growth: "성장형",
};

/** 온보딩 폼의 3단계 제목. 채팅 화면의 "현재 조건" 요약도 같은 단계 구분을 쓴다. */
export const STEP_META = [
  { title: "기본 정보" },
  { title: "기능① 정책 매칭 조건" },
  { title: "기능② 자산관리 로드맵 조건" },
] as const;

function won(value?: number | null): string | null {
  if (value == null) return null;
  return `${Math.round(value / 10_000).toLocaleString("ko-KR")}만원`;
}

export type ProfileFieldSummary = {
  key: string;
  label: string;
  /** STEP_META 인덱스 */
  step: number;
  value: (p: Partial<UserProfile> | null | undefined) => string | null;
};

/** 채팅 화면 "현재 조건" 요약과 폼의 실시간 요약 카드가 함께 쓰는 필드 목록. */
export const PROFILE_FIELD_SUMMARY: ProfileFieldSummary[] = [
  { key: "birthDate", label: "생년월일", step: 0, value: (p) => p?.birthDate ?? null },
  { key: "region", label: "거주 지역", step: 0, value: (p) => p?.region ?? null },
  { key: "annualIncomeKrw", label: "연 소득", step: 0, value: (p) => won(p?.annualIncomeKrw) },
  {
    key: "householdSize",
    label: "가구원 수",
    step: 0,
    value: (p) => (p?.householdSize != null ? `${p.householdSize}명` : null),
  },
  { key: "employmentType", label: "고용 형태", step: 1, value: (p) => p?.employmentType ?? null },
  {
    key: "maritalStatus",
    label: "혼인 상태",
    step: 1,
    value: (p) => MARRIAGE_OPTIONS.find((m) => m.value === p?.maritalStatus)?.label ?? null,
  },
  {
    key: "housingStatus",
    label: "주거 형태",
    step: 1,
    value: (p) => HOUSING_OPTIONS.find((h) => h.value === p?.housingStatus)?.label ?? null,
  },
  // 아래 4개는 온보딩 폼에서 직접 묻지 않고, 대화 중 AI가 추가로 물어본
  // profile_ask 답변으로만 채워진다(ProfileAskForm 참고) — 그래서 이 카드에
  // 없으면 "방금 답한 게 실제로 반영됐는지" 확인할 방법이 없었다.
  {
    key: "financialIncomeTaxed",
    label: "금융소득종합과세 이력",
    step: 1,
    value: (p) =>
      typeof p?.financialIncomeTaxed === "boolean" ? (p.financialIncomeTaxed ? "있음" : "없음") : null,
  },
  {
    key: "isSmeEmployee",
    label: "중소기업 재직 여부",
    step: 1,
    value: (p) => (typeof p?.isSmeEmployee === "boolean" ? (p.isSmeEmployee ? "재직" : "미재직") : null),
  },
  {
    key: "householdMonthlyIncome",
    label: "가구 전체 월소득",
    step: 1,
    value: (p) => won(p?.householdMonthlyIncome),
  },
  {
    key: "previousAnnualIncome",
    label: "직전년도 연 소득",
    step: 1,
    value: (p) => won(p?.previousAnnualIncome),
  },
  { key: "monthlyBudget", label: "월 저축여력", step: 2, value: (p) => won(p?.monthlyBudget) },
  { key: "targetDate", label: "목표 시점", step: 2, value: (p) => p?.targetDate ?? null },
  {
    key: "hasEmergencyFund",
    label: "비상자금 보유",
    step: 2,
    value: (p) =>
      typeof p?.hasEmergencyFund === "boolean" ? (p.hasEmergencyFund ? "예" : "아니오") : null,
  },
  { key: "targetAmount", label: "목표 금액", step: 2, value: (p) => won(p?.targetAmount) },
  {
    key: "riskLevel",
    label: "투자 성향",
    step: 2,
    value: (p) => (p?.riskLevel ? RISK_LEVEL_LABELS[p.riskLevel] ?? p.riskLevel : null),
  },
  {
    key: "investmentCap",
    label: "투자상품 최대 배분",
    step: 2,
    value: (p) => (p?.investmentCap != null ? `${p.investmentCap}%` : null),
  },
];
